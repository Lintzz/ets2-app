// ETS2_Servidor/status_renderer.js
// Roda no processo de renderização, sem acesso ao Node: tudo passa pela API
// exposta em preload.js como window.servidor.

const statusText = document.getElementById("status-text");
const ipText = document.getElementById("ip-text");
const ipsText = document.getElementById("ips-text");
const clientText = document.getElementById("client-text");
const pairedText = document.getElementById("paired-text");
const logBox = document.getElementById("log-box");
const logCount = document.getElementById("log-count");
const mainStatusPanel = document.getElementById("main-status-panel");
const uptimeText = document.getElementById("uptime");
const footerStatus = document.getElementById("footer-status");
const appVersao = document.getElementById("app-versao");

const MAX_LINHAS_LOG = 500;

const CORES = {
  verde: "oklch(0.82 0.19 145)",
  azul: "oklch(0.75 0.13 220)",
  ambar: "oklch(0.85 0.15 85)",
  vermelho: "oklch(0.7 0.2 25)",
  cinza: "#6e7d79",
};

// O processo principal manda o log como uma frase só. A tag colorida do design
// é deduzida aqui pela palavra-chave — assim nada muda no protocolo IPC.
function classificar(msg) {
  if (/erro|falha|recusad|desatualizado|não foi possível/i.test(msg)) {
    return { tag: "ERR", cor: CORES.vermelho };
  }
  if (/plugin|\.dll/i.test(msg)) return { tag: "PLUG", cor: CORES.verde };
  if (/pareado|pareamento|aparelho|conect|desconect|cliente/i.test(msg)) {
    return { tag: "PAIR", cor: CORES.ambar };
  }
  if (/\bip\b|interface|porta|rede|firewall|websocket|udp|http/i.test(msg)) {
    return { tag: "NET", cor: CORES.azul };
  }
  if (/^status:/i.test(msg)) return { tag: "STAT", cor: CORES.cinza };
  return { tag: "INFO", cor: CORES.cinza };
}

function atualizarContagem() {
  const n = logBox.childElementCount;
  logCount.textContent = `${n} ${n === 1 ? "linha" : "linhas"}`;
}

function addLog(message) {
  const { tag, cor } = classificar(message);

  const entrada = document.createElement("div");
  entrada.className = "entrada";

  const hora = document.createElement("span");
  hora.className = "hora";
  hora.textContent = new Date().toLocaleTimeString();

  const rotulo = document.createElement("span");
  rotulo.className = "tag";
  rotulo.style.color = cor;
  rotulo.textContent = tag;

  const texto = document.createElement("span");
  texto.className = "msg";
  texto.textContent = message;

  entrada.append(hora, rotulo, texto);
  logBox.appendChild(entrada);

  // Sem isto o log crescia sem limite numa sessão longa.
  while (logBox.childElementCount > MAX_LINHAS_LOG) {
    logBox.removeChild(logBox.firstChild);
  }

  atualizarContagem();
  logBox.scrollTop = logBox.scrollHeight;
}

document.getElementById("log-clear").addEventListener("click", () => {
  logBox.replaceChildren();
  atualizarContagem();
});

// A janela mostra só a sessão atual; o arquivo guarda as anteriores.
document.getElementById("log-abrir").addEventListener("click", () => {
  window.servidor.abrirLogs();
});

function updateStatusDisplay(status) {
  statusText.textContent = status;
  footerStatus.textContent = status;

  let cor = CORES.cinza;
  if (status.includes("transmitir")) {
    cor = CORES.verde;
  } else if (status.includes("menu") || status.includes("pausado")) {
    cor = CORES.ambar;
  } else if (
    status.includes("não detectado") ||
    status.includes("Erro") ||
    status.includes("desatualizado")
  ) {
    cor = CORES.vermelho;
  }

  // O dot, a borda do cartão, a varredura e o dot do rodapé leem esta variável.
  document.documentElement.style.setProperty("--cor-status", cor);
}

// --- Uptime da janela ---

let inicioUptime = Date.now();

function pintarUptime() {
  const total = Math.floor((Date.now() - inicioUptime) / 1000);
  const partes = [
    Math.floor(total / 3600),
    Math.floor(total / 60) % 60,
    total % 60,
  ].map((n) => String(n).padStart(2, "0"));
  uptimeText.textContent = `uptime ${partes.join(":")}`;
}

pintarUptime();
setInterval(pintarUptime, 1000);

// --- Controles da janela ---

document.getElementById("minimize-btn").addEventListener("click", () => {
  window.servidor.minimizar();
});
document.getElementById("maximize-btn").addEventListener("click", () => {
  window.servidor.maximizar();
});
document.getElementById("close-btn").addEventListener("click", () => {
  window.servidor.fechar();
});

// --- Ações ---

document.getElementById("restart-server-btn").addEventListener("click", () => {
  window.servidor.reiniciar();
  inicioUptime = Date.now();
  pintarUptime();
  addLog("Ação: enviando comando para reiniciar o servidor...");
});

document.getElementById("forget-device-btn").addEventListener("click", () => {
  window.servidor.esquecerAparelho();
});

// --- Eventos vindos do processo principal ---

window.servidor.aoReceberLog(addLog);

// O status agora só chega quando muda de verdade (antes era 4x por segundo e
// enchia o log), então dá para registrar cada mudança.
window.servidor.aoMudarStatus((message) => {
  updateStatusDisplay(message);
  addLog(`Status: ${message}`);
});

window.servidor.aoReceberInformacoes((info) => {
  if (!info) return;

  ipText.textContent = info.port ? `${info.serverIp}:${info.port}` : info.serverIp;

  const outros = (info.enderecos || [])
    .filter((e) => e.ip !== info.serverIp)
    .map((e) => `${e.ip} (${e.nome})`);
  ipsText.textContent = outros.length > 0 ? outros.join(" · ") : "—";
  ipsText.title = outros.join("\n");

  clientText.textContent = info.clienteIp
    ? `${info.clienteNome || "aparelho"} — ${info.clienteIp}`
    : "Nenhum";
  clientText.classList.toggle("apagado", !info.clienteIp);
  clientText.classList.toggle("neutro", Boolean(info.clienteIp));

  pairedText.textContent = info.pareado ? info.pareado.nome : "Nenhum";

  pintarCodigo(info);
});

// --- Código de pareamento ----------------------------------------------------

const painelCodigo = document.getElementById("painel-codigo");
const codigoValor = document.getElementById("codigo-valor");
const codigoPrazo = document.getElementById("codigo-prazo");

let expiraEm = null;

// O painel só existe enquanto ninguém está pareado: depois disso o aparelho
// entra provando o segredo, sem código nenhum.
function pintarCodigo(info) {
  const mostrar = Boolean(info.codigo) && !info.pareado;
  painelCodigo.hidden = !mostrar;

  if (!mostrar) {
    expiraEm = null;
    return;
  }

  codigoValor.textContent = info.codigo;
  expiraEm = info.codigoExpiraEm || null;
  pintarPrazo();
}

function pintarPrazo() {
  if (painelCodigo.hidden) return;

  if (!expiraEm) {
    codigoPrazo.textContent = "Digite este código no aplicativo.";
    return;
  }

  const restante = Math.max(0, Math.round((expiraEm - Date.now()) / 1000));

  if (restante === 0) {
    codigoPrazo.textContent = 'Código vencido — clique em "Gerar outro código".';
    return;
  }

  const m = Math.floor(restante / 60);
  const s = String(restante % 60).padStart(2, "0");
  codigoPrazo.textContent = `Digite no aplicativo — vence em ${m}:${s}`;
}

setInterval(pintarPrazo, 1000);

document.getElementById("codigo-novo").addEventListener("click", () => {
  window.servidor.novoCodigo();
});

// --- Instalação do plugin no jogo ---

const pluginPanel = document.getElementById("plugin-panel");
const pluginEstado = document.getElementById("plugin-estado");
const pluginCaminho = document.getElementById("plugin-caminho");
const btnEscolher = document.getElementById("plugin-escolher-btn");
const btnInstalar = document.getElementById("plugin-instalar-btn");
const btnAbrir = document.getElementById("plugin-abrir-btn");
const btnVerificar = document.getElementById("plugin-verificar-btn");
const pluginOrigem = document.getElementById("plugin-origem");

function escreverEstado(icone, cor, texto) {
  pluginPanel.style.setProperty("--cor-plugin", cor);
  pluginEstado.replaceChildren();

  const marca = document.createElement("span");
  marca.className = "icone";
  marca.textContent = icone;

  const rotulo = document.createElement("span");
  rotulo.textContent = texto;

  pluginEstado.append(marca, rotulo);
}

function pintarPlugin(estado) {
  if (!estado || !estado.valida) {
    escreverEstado("✕", CORES.vermelho, "Pasta do ETS2 não encontrada");
    pluginCaminho.textContent =
      'Clique em "Escolher pasta" e aponte para a pasta do Euro Truck Simulator 2.';
    pluginCaminho.title = "";
    btnInstalar.disabled = true;
    btnAbrir.disabled = true;
    return;
  }

  btnAbrir.disabled = false;
  btnInstalar.disabled = false;

  if (estado.atualizado) {
    escreverEstado("✓", CORES.verde, "Instalado e atualizado");
    btnInstalar.textContent = "Reinstalar";
  } else if (estado.instalado) {
    escreverEstado("!", CORES.ambar, "Instalado, mas de outra versão");
    btnInstalar.textContent = "Atualizar plugin";
  } else {
    escreverEstado("!", CORES.ambar, "Plugin ainda não instalado");
    btnInstalar.textContent = "Instalar plugin";
  }

  pluginCaminho.textContent = estado.destino || estado.pastaJogo;
  pluginCaminho.title = estado.destino || estado.pastaJogo;
  pintarOrigem(estado);
}

// De onde vem a DLL que será instalada: a release do GitHub (sempre a mais
// nova) ou a que veio junto com o instalador, quando não há internet.
function pintarOrigem(estado) {
  if (!estado) return;

  if (estado.origem === "release") {
    pluginOrigem.innerHTML =
      `DLL: <span class="fonte">release ${estado.tag}</span> do GitHub`;
  } else {
    pluginOrigem.innerHTML =
      `DLL: <span class="fonte">a que veio no instalador</span> — ` +
      (estado.motivo || "sem acesso ao GitHub");
  }
}

async function atualizarPlugin() {
  pintarPlugin(await window.servidor.plugin.estado());
}

btnEscolher.addEventListener("click", async () => {
  btnEscolher.disabled = true;
  pintarPlugin(await window.servidor.plugin.escolherPasta());
  btnEscolher.disabled = false;
});

btnInstalar.addEventListener("click", async () => {
  btnInstalar.disabled = true;
  escreverEstado("…", CORES.ambar, "Instalando...");

  const r = await window.servidor.plugin.instalar();
  addLog(`Plugin: ${r.mensagem}`);
  pintarPlugin(r.estado);

  if (r.ok && !r.jaAtualizado) {
    addLog("Reinicie o Euro Truck Simulator 2 para o novo plugin ser carregado.");
  }
});

btnVerificar.addEventListener("click", async () => {
  btnVerificar.disabled = true;
  pluginOrigem.textContent = "Consultando o GitHub...";

  const estado = await window.servidor.plugin.verificarAtualizacao();
  pintarPlugin(estado);
  addLog(`Plugin: ${estado.motivo}`);

  btnVerificar.disabled = false;
});

btnAbrir.addEventListener("click", () => window.servidor.plugin.abrirPasta());

atualizarPlugin();

window.servidor.versao().then((v) => {
  appVersao.textContent = `v${v}`;
});

window.servidor.pedirInformacoes();
