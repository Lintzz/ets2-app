// ETS2_Servidor/server.js
// Roda como processo filho de main.js (fork), conversa com o pai por process.send.

const http = require("http");
const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");
const leitorMemoria = require("./build/Release/leitor_memoria");
const robot = require("robotjs");

const {
  PROTOCOLO_VERSAO,
  SCHEMA_ESPERADO,
  DISCOVERY_PORT,
  TCP_PORT,
  UDP_PROBE,
  UDP_ANNOUNCE,
  TECLAS_PERMITIDAS,
} = require("./protocolo");

// 20 Hz. O antigo era 250 ms (4 Hz), que deixava ponteiro de RPM e velocímetro
// visivelmente escalonados. A leitura da memória é barata.
const TELEMETRIA_INTERVALO_MS = 50;
const ANNOUNCE_INTERVALO_MS = 2000;
const HELLO_TIMEOUT_MS = 5000;

const ARQUIVO_PAREAMENTO = path.join(
  process.env.ETS2_USER_DATA || __dirname,
  "pareamento.json"
);

// --- Comunicação com o processo pai -----------------------------------------

const enviarAoPai = (msg) => {
  if (typeof process.send === "function") process.send(msg);
};

const log = (message) => enviarAoPai({ type: "log", message });

let ultimoStatus = null;
const status = (message) => {
  // Antes isto era disparado a cada tick (4x/s) e inundava a janela de log.
  if (message === ultimoStatus) return;
  ultimoStatus = message;
  enviarAoPai({ type: "status", message });
};

log("================================================");
log("        SERVIDOR DO DASHBOARD ETS2 INICIADO");
log("================================================\n");

// Sanidade do addon nativo: o fork @electron/node-gyp compila com clang-cl e
// gera um .node que passa no build mas devolve numeros aleatorios. Sem esta
// checagem isso apareceria como telemetria corrompida, sem nenhum erro.
if (leitorMemoria.schemaVersion !== SCHEMA_ESPERADO) {
  log(
    `ERRO: addon nativo invalido (schemaVersion = ${leitorMemoria.schemaVersion}, ` +
      `esperado ${SCHEMA_ESPERADO}). Recompile com "npm run build:addon".`
  );
  status("Addon nativo invalido - rode npm run build:addon.");
}

// --- Endereços de rede -------------------------------------------------------

// Devolve todos os IPv4 utilizáveis da máquina, com o endereço de broadcast
// calculado a partir da máscara real (não assumindo /24 como antes).
function enderecosLocais() {
  const resultado = [];
  const interfaces = os.networkInterfaces();

  for (const nome of Object.keys(interfaces)) {
    for (const net of interfaces[nome] || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (net.address.startsWith("169.254.")) continue; // APIPA: sem DHCP

      resultado.push({
        nome,
        ip: net.address,
        netmask: net.netmask,
        broadcast: calcularBroadcast(net.address, net.netmask),
      });
    }
  }
  return resultado;
}

function calcularBroadcast(ip, netmask) {
  if (!netmask) return null;
  const partesIp = ip.split(".").map(Number);
  const partesMascara = netmask.split(".").map(Number);
  if (partesIp.length !== 4 || partesMascara.length !== 4) return null;
  return partesIp
    .map((octeto, i) => (octeto & partesMascara[i]) | (~partesMascara[i] & 0xff))
    .join(".");
}

// Adaptadores virtuais e de VPN (VirtualBox, VMware, Hyper-V, WSL, Docker,
// Radmin, Hamachi, ZeroTier, Tailscale...) costumam aparecer ANTES do adaptador
// real. O código antigo pegava simplesmente o primeiro da lista, e nesta
// máquina isso significava anunciar o IP da Radmin VPN (26.x.x.x) — um endereço
// que o celular na Wi-Fi nunca consegue alcançar.
const NOMES_VIRTUAIS =
  /virtual|vmware|vbox|hyper-v|wsl|docker|loopback|tap|tun|bluetooth|vpn|radmin|hamachi|zerotier|tailscale|wireguard|openvpn|nordlynx/i;

// Pontua cada endereço para escolher o que o celular tem chance de alcançar:
// rede doméstica típica (192.168.x.x/24) ganha de tudo; adaptador virtual perde.
function pontuar(endereco) {
  let pontos = 0;
  const [a, b] = endereco.ip.split(".").map(Number);

  if (NOMES_VIRTUAIS.test(endereco.nome)) pontos -= 100;

  if (a === 192 && b === 168) pontos += 30;
  else if (a === 172 && b >= 16 && b <= 31) pontos += 20;
  else if (a === 10) pontos += 10;

  if (endereco.netmask === "255.255.255.0") pontos += 10; // /24: LAN de casa
  if (/^(ethernet|wi-?fi|wireless|wlan|lan)/i.test(endereco.nome)) pontos += 5;

  return pontos;
}

// Melhor primeiro.
function ordenarEnderecos(enderecos) {
  return [...enderecos].sort((x, y) => pontuar(y) - pontuar(x));
}

function enderecoPreferido(enderecos) {
  const ordenados = ordenarEnderecos(enderecos);
  return (ordenados[0] || {}).ip || "127.0.0.1";
}

// Interfaces para as quais vale a pena mandar broadcast (evita inundar a rede
// virtual de uma VPN, que tem broadcast domain enorme).
function enderecosParaBroadcast(enderecos) {
  return enderecos.filter((e) => !NOMES_VIRTUAIS.test(e.nome) && e.broadcast);
}

// --- Pareamento --------------------------------------------------------------
// O primeiro aparelho que conectar é memorizado. Os outros são recusados até
// alguém clicar em "Esquecer aparelho" na janela do servidor. Isso impede que
// qualquer pessoa no mesmo Wi-Fi acione os comandos do seu jogo.

function lerPareamento() {
  try {
    const bruto = fs.readFileSync(ARQUIVO_PAREAMENTO, "utf8");
    const dados = JSON.parse(bruto);
    return dados && typeof dados.deviceId === "string" ? dados : null;
  } catch {
    return null;
  }
}

function salvarPareamento(deviceId, nome) {
  try {
    fs.writeFileSync(
      ARQUIVO_PAREAMENTO,
      JSON.stringify({ deviceId, nome, pareadoEm: new Date().toISOString() }, null, 2)
    );
    return true;
  } catch (e) {
    log(`Não foi possível salvar o pareamento: ${e.message}`);
    return false;
  }
}

function esquecerPareamento() {
  try {
    fs.unlinkSync(ARQUIVO_PAREAMENTO);
  } catch {
    /* já não existia */
  }
  log(">>> Pareamento apagado. O próximo aparelho que conectar será o novo. <<<");
  for (const cliente of wss.clients) {
    try {
      cliente.close(4001, "pareamento-reiniciado");
    } catch {
      /* ignora */
    }
  }
  enviarAoPai({ type: "pareamento", pareado: null });
}

// --- Teclado -----------------------------------------------------------------

function pressionar(ws, tipo, tecla) {
  if (typeof tecla !== "string" || !TECLAS_PERMITIDAS.has(tecla)) {
    log(`Comando recusado: a tecla "${tecla}" não está na lista permitida.`);
    return null;
  }

  if (tipo === "press_key") {
    robot.keyTap(tecla);
    return `Tecla pressionada: ${tecla}`;
  }
  if (tipo === "hold_key_down") {
    robot.keyToggle(tecla, "down");
    ws.teclasSeguradas.add(tecla);
    return `Tecla mantida (DOWN): ${tecla}`;
  }
  if (tipo === "hold_key_up") {
    robot.keyToggle(tecla, "up");
    ws.teclasSeguradas.delete(tecla);
    return `Tecla liberada (UP): ${tecla}`;
  }
  return null;
}

// Se o cliente cair segurando um botão (acelerador, retarder), a tecla ficaria
// pressionada para sempre no PC. Soltamos tudo no disconnect.
function soltarTeclasSeguradas(ws) {
  for (const tecla of ws.teclasSeguradas) {
    try {
      robot.keyToggle(tecla, "up");
    } catch {
      /* ignora */
    }
  }
  if (ws.teclasSeguradas.size > 0) {
    log(`Teclas liberadas após desconexão: ${[...ws.teclasSeguradas].join(", ")}`);
  }
  ws.teclasSeguradas.clear();
}

// --- Servidor HTTP + WebSocket ----------------------------------------------

// GET /ets2 identifica este servidor para a varredura de rede do app. É a via
// de descoberta principal: o app pergunta de IP em IP na própria sub-rede, o
// que não depende de broadcast chegar do cabo até o rádio do Wi-Fi (que é
// justamente o que fazia o app só funcionar via tethering USB).
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/ets2") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        t: UDP_ANNOUNCE,
        v: PROTOCOLO_VERSAO,
        port: TCP_PORT,
        nome: os.hostname(),
      })
    );
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocket.Server({ server });

let telemetryInterval = null;
let avisoSchemaEmitido = false;

const clientesAutenticados = () =>
  [...wss.clients].filter(
    (c) => c.autenticado && c.readyState === WebSocket.OPEN
  );

function transmitirTelemetria() {
  const clientes = clientesAutenticados();
  if (clientes.length === 0) return;

  const dados = leitorMemoria.lerDados();
  let payload;

  if (dados === null) {
    status("Jogo (ETS2) não detectado. Aguardando... 🛑");
    payload = "null";
  } else if (dados.erroSchema) {
    if (!avisoSchemaEmitido) {
      avisoSchemaEmitido = true;
      log(
        `ERRO: o PluginETS2.dll carregado no jogo é de outra versão ` +
          `(schema ${dados.versaoPlugin}/${dados.tamanhoPlugin} bytes, ` +
          `esperado ${dados.versaoEsperada}/${dados.tamanhoEsperado} bytes). ` +
          `Recompile o plugin e copie a DLL nova para a pasta plugins do ETS2.`
      );
    }
    status("Plugin do jogo desatualizado — recompile a DLL. ⚠️");
    payload = JSON.stringify({ jogoRodando: false, erro: "schema" });
  } else if (!dados.jogoRodando) {
    // Fonte de verdade é o evento paused/started do próprio jogo. A heurística
    // antiga (comparar JSON e declarar inatividade após 30 s) desligava o painel
    // com o caminhão parado e o motor desligado, mesmo com o jogo rodando.
    status("Jogo no menu ou pausado. Conexão mantida. ⏸️");
    payload = JSON.stringify({ jogoRodando: false, inMenu: true });
  } else {
    avisoSchemaEmitido = false;
    status("Dados do jogo encontrados! A transmitir... ✅");
    payload = JSON.stringify(dados);
  }

  // Uma leitura e uma serialização por tick, para todos os clientes. Antes
  // existia um setInterval por conexão, e a segunda conexão quebrava a primeira.
  for (const cliente of clientes) {
    cliente.send(payload);
  }
}

function ajustarLoopDeTelemetria() {
  const ativos = clientesAutenticados().length;

  if (ativos > 0 && !telemetryInterval) {
    telemetryInterval = setInterval(transmitirTelemetria, TELEMETRIA_INTERVALO_MS);
  } else if (ativos === 0 && telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
    status("Aguardando conexão do tablet...");
  }
}

wss.on("connection", (ws, req) => {
  ws.autenticado = false;
  ws.teclasSeguradas = new Set();
  ws.enderecoRemoto = (req.socket.remoteAddress || "").replace("::ffff:", "");

  // Sem "hello" em 5 s a conexão cai: nada de telemetria antes de identificar.
  const timerHello = setTimeout(() => {
    if (!ws.autenticado) ws.close(4002, "sem-identificacao");
  }, HELLO_TIMEOUT_MS);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      log("Mensagem inválida recebida do cliente (JSON malformado).");
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "hello") {
      if (ws.autenticado) return;
      const deviceId = typeof msg.deviceId === "string" ? msg.deviceId : null;
      const nome = typeof msg.nome === "string" ? msg.nome.slice(0, 60) : "aparelho";

      if (!deviceId) {
        ws.close(4002, "sem-identificacao");
        return;
      }

      const pareado = lerPareamento();
      if (pareado && pareado.deviceId !== deviceId) {
        log(
          `>>> Conexão RECUSADA de ${ws.enderecoRemoto} ("${nome}"): ` +
            `já existe um aparelho pareado ("${pareado.nome}"). ` +
            `Use "Esquecer aparelho" para trocar. <<<`
        );
        ws.send(JSON.stringify({ type: "denied", reason: "ja-pareado" }));
        ws.close(4003, "ja-pareado");
        return;
      }

      if (!pareado) {
        salvarPareamento(deviceId, nome);
        log(`>>> Novo aparelho pareado: "${nome}" (${ws.enderecoRemoto}) <<<`);
        enviarAoPai({ type: "pareamento", pareado: { nome, deviceId } });
      }

      clearTimeout(timerHello);
      ws.autenticado = true;
      ws.send(JSON.stringify({ type: "welcome", protocolo: PROTOCOLO_VERSAO }));
      log(`\n>>> Tablet conectado com sucesso! (IP do cliente: ${ws.enderecoRemoto}) <<<\n`);
      enviarAoPai({ type: "cliente", ip: ws.enderecoRemoto, nome });
      ajustarLoopDeTelemetria();
      return;
    }

    if (!ws.autenticado) return;

    const acao = pressionar(ws, msg.type, msg.payload);
    if (acao) log(`Ação Remota: ${acao}`);
  });

  ws.on("close", () => {
    clearTimeout(timerHello);
    soltarTeclasSeguradas(ws);
    if (ws.autenticado) {
      log("\n>>> Tablet desconectado. Parando a transmissão. <<<\n");
      enviarAoPai({ type: "cliente", ip: null });
    }
    ajustarLoopDeTelemetria();
  });

  ws.on("error", (e) => log(`Erro no WebSocket do cliente: ${e.message}`));
});

server.on("error", (e) => {
  log(`ERRO ao abrir a porta ${TCP_PORT}: ${e.message}`);
  status("Erro ao iniciar o servidor. ⚠️");
});

server.listen(TCP_PORT, "0.0.0.0", () => {
  log(`Servidor TCP na porta ${TCP_PORT}, aceitando conexões de toda a rede.`);
  status("Aguardando conexão do tablet...");

  const pareado = lerPareamento();
  if (pareado) {
    log(`Aparelho pareado: "${pareado.nome}". Outros aparelhos serão recusados.`);
  } else {
    log("Nenhum aparelho pareado ainda — o primeiro que conectar será memorizado.");
  }
  enviarAoPai({ type: "pareamento", pareado });
});

// --- Descoberta (UDP) --------------------------------------------------------
// Duas vias, porque o broadcast do PC nem sempre chega no celular por Wi-Fi
// (roteadores/APs frequentemente não repassam broadcast do cabo para o rádio, e
// o Android descarta broadcast sem multicast lock):
//   1. o app manda um "probe" e nós respondemos por UNICAST — esta é a via que
//      funciona em praticamente qualquer roteador;
//   2. continuamos anunciando por broadcast, para clientes antigos e para o
//      caso do app ainda não estar procurando.

const discoverySocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

discoverySocket.on("error", (e) => {
  log(`Erro no socket de descoberta UDP: ${e.message}`);
});

discoverySocket.on("message", (msg, rinfo) => {
  let pacote;
  try {
    pacote = JSON.parse(msg.toString());
  } catch {
    return;
  }
  if (!pacote || pacote.t !== UDP_PROBE) return;

  // Resposta direcionada: não depende de broadcast chegar ao celular.
  const enderecos = enderecosLocais();
  const resposta = Buffer.from(
    JSON.stringify({
      t: UDP_ANNOUNCE,
      v: PROTOCOLO_VERSAO,
      serverIp: enderecoPreferido(enderecos),
      ips: ordenarEnderecos(enderecos).map((e) => e.ip),
      port: TCP_PORT,
      nome: os.hostname(),
    })
  );
  discoverySocket.send(resposta, 0, resposta.length, rinfo.port, rinfo.address);
});

discoverySocket.bind(DISCOVERY_PORT, () => {
  discoverySocket.setBroadcast(true);

  const enderecos = enderecosLocais();
  log(`Descoberta UDP ouvindo na porta ${DISCOVERY_PORT}.`);
  log(
    enderecos.length > 0
      ? `Endereços desta máquina: ${enderecos.map((e) => `${e.ip} (${e.nome})`).join(", ")}`
      : "Nenhum adaptador de rede com IPv4 encontrado."
  );
  enviarAoPai({
    type: "server-ip",
    ip: enderecoPreferido(enderecos),
    enderecos: ordenarEnderecos(enderecos),
    port: TCP_PORT,
  });

  setInterval(() => {
    if (clientesAutenticados().length > 0) return;

    const atuais = enderecosLocais();
    const anuncio = Buffer.from(
      JSON.stringify({
        t: UDP_ANNOUNCE,
        v: PROTOCOLO_VERSAO,
        serverIp: enderecoPreferido(atuais),
        ips: ordenarEnderecos(atuais).map((e) => e.ip),
        port: TCP_PORT,
        nome: os.hostname(),
      })
    );

    // 255.255.255.255 sai só pela interface padrão; o broadcast dirigido de cada
    // adaptador cobre as demais (cabo + tethering ao mesmo tempo, por exemplo).
    const destinos = new Set(["255.255.255.255"]);
    for (const e of enderecosParaBroadcast(atuais)) destinos.add(e.broadcast);

    for (const destino of destinos) {
      discoverySocket.send(anuncio, 0, anuncio.length, DISCOVERY_PORT, destino, (err) => {
        if (err) log(`Falha ao anunciar em ${destino}: ${err.message}`);
      });
    }
  }, ANNOUNCE_INTERVALO_MS);
});

// --- Comandos vindos do processo pai ----------------------------------------

process.on("message", (msg) => {
  if (msg && msg.type === "esquecer-pareamento") esquecerPareamento();
});
