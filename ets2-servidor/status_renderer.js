// ETS2_Servidor/status_renderer.js
// Roda no Processo de Renderização do Electron (Janela de Status)

const { ipcRenderer } = require("electron");

// --- Elementos DOM ---
const statusText = document.getElementById("status-text");
const ipText = document.getElementById("ip-text");
const clientText = document.getElementById("client-text");
const logBox = document.getElementById("log-box");
const mainStatusPanel = document.getElementById("main-status-panel");
const restartButton = document.getElementById("restart-server-btn");

// Botões de controle de janela
const minimizeBtn = document.getElementById("minimize-btn");
const maximizeBtn = document.getElementById("maximize-btn");
const closeBtn = document.getElementById("close-btn");

// --- Funções de UI ---

// Função para adicionar log e rolar para o final
function addLog(message) {
  const logEntry = document.createElement("div");
  // Adiciona uma classe para evitar quebra de linha em longas mensagens
  logEntry.className = "py-0.5 border-b border-gray-700 last:border-b-0";
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logBox.appendChild(logEntry);
  logBox.scrollTop = logBox.scrollHeight;
}

// Função para atualizar o painel principal com base no status
function updateStatusDisplay(status, clientIp = null) {
  statusText.textContent = status;

  // Remove todas as classes de cor de fundo
  mainStatusPanel.classList.remove(
    "bg-gray-800",
    "bg-red-900",
    "bg-green-900",
    "bg-orange-900"
  );

  // Define a cor com base no status atual
  if (status.includes("Aguardando conex")) {
    mainStatusPanel.classList.add("bg-gray-800");
    clientText.textContent = "Nenhum";
  } else if (status.includes("conectado") && status.includes("a transmitir")) {
    mainStatusPanel.classList.add("bg-green-900");
    clientText.textContent = clientIp || "Conectado";
  } else if (
    status.includes("aguardar dados") ||
    status.includes("a transmitir")
  ) {
    // Usa Laranja para o estado de "Conectado, mas aguardando dados do jogo"
    mainStatusPanel.classList.add("bg-orange-900");
    clientText.textContent = clientIp || "Conectado";
  } else if (status.includes("Jogo (ETS2) não detectado")) {
    mainStatusPanel.classList.add("bg-red-900");
    clientText.textContent = "Nenhum";
  } else if (status.includes("Erro")) {
    mainStatusPanel.classList.add("bg-red-900");
  }
}

// --- LÓGICA DE CONTROLE DA JANELA ---

minimizeBtn.addEventListener("click", () => {
  ipcRenderer.send("window-control", "minimize");
});

maximizeBtn.addEventListener("click", () => {
  ipcRenderer.send("window-control", "maximize");
});

closeBtn.addEventListener("click", () => {
  ipcRenderer.send("window-control", "close");
});

// --- LÓGICA DE COMUNICAÇÃO (IPC) ---

// Listener para o botão de Reiniciar
restartButton.addEventListener("click", () => {
  ipcRenderer.send("restart-server");
  addLog("Ação: Enviando comando para reiniciar o servidor...");
});

// Listener para Logs do Processo Principal
ipcRenderer.on("server-log", (event, message) => {
  addLog(message);

  // Lógica para detecção de IP na mensagem
  if (message.includes("IP do cliente:")) {
    const ipMatch = message.match(/\(IP do cliente: (.*)\)/);
    const ip = ipMatch ? ipMatch[1] : null;
    if (ip) ipcRenderer.send("update-ip", ip); // Envia o IP para o main.js para atualização global
    updateStatusDisplay("Cliente conectado com sucesso!", ip);
  }
});

// Listener para Atualização de Status (mensagens frequentes)
ipcRenderer.on("server-status", (event, message) => {
  updateStatusDisplay(message);
  // Para não lotar o logbox, só adicionamos se o status mudar ou for importante.
  // Neste caso, vamos adicionar para manter a visibilidade do que está acontecendo.
  // Se isso ficar muito lotado, podemos otimizar para logar apenas a cada 5 segundos.
  addLog(`Status: ${message}`);
});

// Listener para o IP do Servidor (informação inicial)
ipcRenderer.on("server-info", (event, info) => {
  if (info.serverIp) {
    ipText.textContent = info.serverIp;
  }
});

// Envia mensagem para o processo principal para pedir informações iniciais
ipcRenderer.send("ready-for-info");
