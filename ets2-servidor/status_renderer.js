// ETS2_Servidor/status_renderer.js
// Roda no processo de renderização, sem acesso ao Node: tudo passa pela API
// exposta em preload.js como window.servidor.

const statusText = document.getElementById("status-text");
const ipText = document.getElementById("ip-text");
const ipsText = document.getElementById("ips-text");
const clientText = document.getElementById("client-text");
const pairedText = document.getElementById("paired-text");
const logBox = document.getElementById("log-box");
const mainStatusPanel = document.getElementById("main-status-panel");

const MAX_LINHAS_LOG = 500;

function addLog(message) {
  const entrada = document.createElement("div");
  entrada.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logBox.appendChild(entrada);

  // Sem isto o log crescia sem limite numa sessão longa.
  while (logBox.childElementCount > MAX_LINHAS_LOG) {
    logBox.removeChild(logBox.firstChild);
  }
  logBox.scrollTop = logBox.scrollHeight;
}

function updateStatusDisplay(status) {
  statusText.textContent = status;
  mainStatusPanel.classList.remove("ok", "espera", "erro");

  if (status.includes("transmitir")) {
    mainStatusPanel.classList.add("ok");
  } else if (status.includes("menu") || status.includes("pausado")) {
    mainStatusPanel.classList.add("espera");
  } else if (
    status.includes("não detectado") ||
    status.includes("Erro") ||
    status.includes("desatualizado")
  ) {
    mainStatusPanel.classList.add("erro");
  }
}

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

  clientText.textContent = info.clienteIp
    ? `${info.clienteNome || "aparelho"} — ${info.clienteIp}`
    : "Nenhum";

  pairedText.textContent = info.pareado ? info.pareado.nome : "Nenhum";
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

function pintarPlugin(estado) {
  pluginPanel.classList.remove("ok", "pendente", "ausente");

  if (!estado || !estado.valida) {
    pluginPanel.classList.add("ausente");
    pluginEstado.textContent = "Pasta do ETS2 não encontrada";
    pluginCaminho.textContent =
      "Clique em \"Escolher pasta\" e aponte para a pasta do Euro Truck Simulator 2.";
    btnInstalar.disabled = true;
    btnAbrir.disabled = true;
    return;
  }

  btnAbrir.disabled = false;

  if (estado.atualizado) {
    pluginPanel.classList.add("ok");
    pluginEstado.textContent = "✅ Plugin instalado e atualizado";
    btnInstalar.disabled = false;
    btnInstalar.textContent = "Reinstalar";
  } else if (estado.instalado) {
    pluginPanel.classList.add("pendente");
    pluginEstado.textContent = "⚠️ Plugin instalado, mas de outra versão";
    btnInstalar.disabled = false;
    btnInstalar.textContent = "⬇ Atualizar plugin";
  } else {
    pluginPanel.classList.add("pendente");
    pluginEstado.textContent = "Plugin ainda não instalado";
    btnInstalar.disabled = false;
    btnInstalar.textContent = "⬇ Instalar plugin";
  }

  pluginCaminho.textContent = estado.destino || estado.pastaJogo;
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
  pluginEstado.textContent = "Instalando...";

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

window.servidor.pedirInformacoes();
