// ETS2_Servidor/server.js
// Roda como processo filho de main.js (fork), conversa com o pai por process.send.

const http = require("http");
const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
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
  CODIGO_DIGITOS,
  CODIGO_VALIDADE_MS,
  NONCE_BYTES,
  SEGREDO_BYTES,
  montarProva,
  RECUSA,
  TECLAS_PERMITIDAS,
} = require("./protocolo");

// 20 Hz. O antigo era 250 ms (4 Hz), que deixava ponteiro de RPM e velocímetro
// visivelmente escalonados. A leitura da memória é barata.
const TELEMETRIA_INTERVALO_MS = 50;
const ANNOUNCE_INTERVALO_MS = 2000;
const HELLO_TIMEOUT_MS = 5000;

// Teto de comandos por segundo de um cliente já autenticado. O app real manda
// no máximo um punhado por segundo (é um dedo apertando um botão); acima disso
// é script. Passar do teto não derruba a conexão, só descarta o excesso.
const LIMITE_COMANDOS_POR_S = 25;

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
// Só entra quem digitar, no app, o código de 6 dígitos mostrado na janela do
// servidor. Aceitar o primeiro aparelho que aparecesse na rede (como era antes)
// significava que um convidado no Wi-Fi — ou uma página web aberta no navegador
// de qualquer máquina — podia virar o dono e digitar teclas no PC.
//
// No pareamento o servidor sorteia um segredo de 32 bytes e o entrega ao app uma
// única vez. Depois disso o segredo nunca mais trafega: a cada conexão o
// servidor manda um nonce e o app devolve SHA-256(nonce:segredo). Quem farejar a
// rede vê só uma prova que não serve para o próximo nonce.

function lerPareamento() {
  try {
    const bruto = fs.readFileSync(ARQUIVO_PAREAMENTO, "utf8");
    const dados = JSON.parse(bruto);
    return dados && typeof dados.deviceId === "string" && typeof dados.segredo === "string"
      ? dados
      : null;
  } catch {
    return null;
  }
}

function salvarPareamento(deviceId, nome, segredo) {
  try {
    fs.writeFileSync(
      ARQUIVO_PAREAMENTO,
      JSON.stringify(
        { deviceId, nome, segredo, pareadoEm: new Date().toISOString() },
        null,
        2
      ),
      // O arquivo guarda o segredo do aparelho: só o dono da conta lê.
      { mode: 0o600 }
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
  log(">>> Pareamento apagado. <<<");
  for (const cliente of wss.clients) {
    try {
      cliente.close(4001, "pareamento-reiniciado");
    } catch {
      /* ignora */
    }
  }
  enviarAoPai({ type: "pareamento", pareado: null });
  gerarCodigo();
}

// --- Código de pareamento ----------------------------------------------------

// Só existe um código válido por vez, some assim que é usado e expira sozinho.
let codigoAtual = null;

function gerarCodigo() {
  const maximo = 10 ** CODIGO_DIGITOS;
  const valor = String(crypto.randomInt(0, maximo)).padStart(CODIGO_DIGITOS, "0");

  codigoAtual = { valor, expiraEm: Date.now() + CODIGO_VALIDADE_MS };
  log(`>>> Código de pareamento: ${valor} (vale ${CODIGO_VALIDADE_MS / 60000} min) <<<`);
  enviarAoPai({ type: "codigo", codigo: valor, expiraEm: codigoAtual.expiraEm });

  return codigoAtual;
}

function limparCodigo() {
  codigoAtual = null;
  enviarAoPai({ type: "codigo", codigo: null, expiraEm: null });
}

// Comparação em tempo constante, para não vazar quantos dígitos bateram.
function iguaisEmTempoConstante(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function codigoConfere(digitado) {
  if (!codigoAtual) return false;
  if (Date.now() > codigoAtual.expiraEm) {
    limparCodigo();
    return false;
  }
  return iguaisEmTempoConstante(codigoAtual.valor, digitado);
}

function provaConfere(nonce, segredo, provaRecebida) {
  const esperada = crypto
    .createHash("sha256")
    .update(montarProva(nonce, segredo))
    .digest("hex");
  return iguaisEmTempoConstante(esperada, provaRecebida);
}

// --- Teclado -----------------------------------------------------------------

// Janela deslizante de 1 s por conexão. Só avisa uma vez enquanto estourado,
// senão o próprio aviso viraria a inundação.
function dentroDoLimite(ws) {
  const agora = Date.now();

  if (agora - ws.janelaInicio >= 1000) {
    ws.janelaInicio = agora;
    ws.comandosNaJanela = 0;
    ws.avisouLimite = false;
  }

  ws.comandosNaJanela += 1;

  if (ws.comandosNaJanela > LIMITE_COMANDOS_POR_S) {
    if (!ws.avisouLimite) {
      ws.avisouLimite = true;
      log(
        `Comandos de ${ws.enderecoRemoto} acima de ${LIMITE_COMANDOS_POR_S}/s — ` +
          `o excesso está sendo descartado.`
      );
    }
    return false;
  }

  return true;
}

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
    // Sem Access-Control-Allow-Origin: o app é nativo e não passa por CORS,
    // mas com "*" qualquer página web aberta no navegador conseguia varrer a
    // rede e ler esta resposta para descobrir o servidor.
    res.writeHead(200, {
      "Content-Type": "application/json",
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

// Barra o ataque de "drive-by": sem isto, uma página web qualquer que o usuário
// abrisse podia varrer a rede local, achar este servidor, conectar e — se ainda
// não houvesse aparelho pareado — virar o par e digitar teclas no PC, sem o
// atacante precisar estar na rede.
//
// O que NÃO dá para fazer é recusar toda conexão que tenha Origin. O React
// Native manda esse cabeçalho sempre, derivado da própria URL do WebSocket
// (WebSocketModule.kt: `builder.addHeader("origin", getDefaultOrigin(url))`,
// que transforma ws://host:porta em http://host:porta). Recusar por presença
// barrava justamente o tablet.
//
// O critério certo é a MESMA ORIGEM: aceitar sem Origin, ou com Origin igual ao
// endereço deste próprio servidor. Um site de terceiro manda a origem dele
// (https://site.exemplo) e o navegador não deixa a página forjar esse valor —
// então continua barrado. E este servidor não serve página HTML nenhuma, então
// não existe página "de mesma origem" para um atacante usar.
function mesmaOrigem(origin, host) {
  if (!host) return false;
  return origin === `http://${host}` || origin === `https://${host}`;
}

function verificarOrigem({ origin, req }, aceitar) {
  const ip = (req.socket.remoteAddress || "").replace("::ffff:", "");

  if (!origin || mesmaOrigem(origin, req.headers.host)) {
    aceitar(true);
    return;
  }

  log(
    `>>> Conexão RECUSADA de ${ip}: veio de outra origem (Origin: ${origin}), ` +
      `o que indica uma página aberta num navegador. <<<`
  );
  aceitar(false, 403, "origem-nao-permitida");
}

const wss = new WebSocket.Server({ server, verifyClient: verificarOrigem });

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
  ws.janelaInicio = Date.now();
  ws.comandosNaJanela = 0;
  ws.avisouLimite = false;

  // Nonce novo a cada conexão: a prova que o app manda serve só para esta.
  ws.nonce = crypto.randomBytes(NONCE_BYTES).toString("hex");

  // Sem "hello" em 5 s a conexão cai: nada de telemetria antes de identificar.
  const timerHello = setTimeout(() => {
    if (!ws.autenticado) ws.close(4002, "sem-identificacao");
  }, HELLO_TIMEOUT_MS);

  const recusar = (motivo, codigoFecho, mensagemLog) => {
    if (mensagemLog) log(mensagemLog);
    try {
      ws.send(JSON.stringify({ type: "denied", reason: motivo }));
    } catch {
      /* socket já caiu */
    }
    ws.close(codigoFecho, motivo);
  };

  // O app precisa do nonce antes de montar o hello, e precisa saber se este
  // servidor já tem dono — para pedir o código ao usuário só quando faz sentido.
  ws.send(
    JSON.stringify({
      type: "challenge",
      protocolo: PROTOCOLO_VERSAO,
      nonce: ws.nonce,
      pareado: Boolean(lerPareamento()),
    })
  );

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

      // App da era do pareamento automático: não manda prova nem código.
      if (msg.protocolo && msg.protocolo < PROTOCOLO_VERSAO) {
        recusar(
          RECUSA.PROTOCOLO,
          4005,
          `>>> Conexão RECUSADA de ${ws.enderecoRemoto} ("${nome}"): o app usa a ` +
            `versão ${msg.protocolo} do protocolo e este servidor usa a ` +
            `${PROTOCOLO_VERSAO}. Atualize o aplicativo. <<<`
        );
        return;
      }

      const pareado = lerPareamento();
      let recemPareado = false;

      if (pareado) {
        // Já existe dono: só entra provando que tem o segredo dele.
        const prova = typeof msg.prova === "string" ? msg.prova : null;

        if (pareado.deviceId !== deviceId || !prova) {
          recusar(
            RECUSA.JA_PAREADO,
            4003,
            `>>> Conexão RECUSADA de ${ws.enderecoRemoto} ("${nome}"): já existe ` +
              `um aparelho pareado ("${pareado.nome}"). Use "Esquecer aparelho" ` +
              `para trocar. <<<`
          );
          return;
        }

        if (!provaConfere(ws.nonce, pareado.segredo, prova)) {
          recusar(
            RECUSA.PROVA_INVALIDA,
            4004,
            `>>> Conexão RECUSADA de ${ws.enderecoRemoto} ("${nome}"): o aparelho ` +
              `não provou ter o segredo do pareamento. <<<`
          );
          return;
        }
      } else {
        // Sem dono: entra quem digitar o código mostrado na janela do servidor.
        const codigo = typeof msg.codigo === "string" ? msg.codigo.trim() : null;

        if (!codigo) {
          recusar(
            RECUSA.PRECISA_CODIGO,
            4006,
            `Aparelho "${nome}" (${ws.enderecoRemoto}) quer parear — ` +
              `digite no app o código mostrado aqui.`
          );
          return;
        }

        if (!codigoConfere(codigo)) {
          recusar(
            RECUSA.CODIGO_INVALIDO,
            4007,
            `>>> Código errado ou expirado vindo de ${ws.enderecoRemoto} ("${nome}"). <<<`
          );
          return;
        }

        const segredo = crypto.randomBytes(SEGREDO_BYTES).toString("hex");
        if (!salvarPareamento(deviceId, nome, segredo)) {
          recusar(RECUSA.CODIGO_INVALIDO, 4007, null);
          return;
        }

        // Uso único: o código morre no instante em que pareia.
        limparCodigo();
        recemPareado = true;
        ws.segredoEntregue = segredo;

        log(`>>> Novo aparelho pareado: "${nome}" (${ws.enderecoRemoto}) <<<`);
        enviarAoPai({ type: "pareamento", pareado: { nome, deviceId } });
      }

      clearTimeout(timerHello);
      ws.autenticado = true;

      // O segredo vai no fio uma única vez, no pareamento. Depois disso só
      // trafega a prova derivada dele.
      ws.send(
        JSON.stringify({
          type: "welcome",
          protocolo: PROTOCOLO_VERSAO,
          ...(recemPareado ? { segredo: ws.segredoEntregue } : {}),
        })
      );

      log(`\n>>> Tablet conectado com sucesso! (IP do cliente: ${ws.enderecoRemoto}) <<<\n`);
      enviarAoPai({ type: "cliente", ip: ws.enderecoRemoto, nome });
      ajustarLoopDeTelemetria();
      return;
    }

    if (!ws.autenticado) return;
    if (!dentroDoLimite(ws)) return;

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
    log("Nenhum aparelho pareado ainda — digite o código abaixo no aplicativo.");
    gerarCodigo();
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
  if (!msg) return;
  if (msg.type === "esquecer-pareamento") esquecerPareamento();
  if (msg.type === "novo-codigo") gerarCodigo();
});
