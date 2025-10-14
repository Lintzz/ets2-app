const { app, Tray, Menu, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { fork } = require("child_process");

if (require('electron-squirrel-startup')) return;

// Variáveis globais
let tray = null;
let mainWindow = null;
let serverProcess = null;
let serverIp = "Aguardando...";

// --- Funções de Comunicação ---
function sendLogToWindow(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server-log", message);
  }
}

function updateServerInfo(ip) {
  serverIp = ip;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server-info", { serverIp: ip });
  }
}

function updateStatusDisplay(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server-status", message);
  }
}

// --- Lógica Principal da Aplicação ---
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 650,
    minHeight: 450,
    title: "ETS2 Server Status",
    show: false,
    // PROPRIEDADES VISUAIS CHAVE:
    frame: false, // <--- REMOVE A BARRA DE TÍTULO E BOTÕES PADRÃO
    autoHideMenuBar: true, // <--- REMOVE O MENU 'FILE', 'EDIT', etc.
    titleBarStyle: "hidden", // (Fallback para outros sistemas)
    // FIM DAS PROPRIEDADES VISUAIS
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "status.html"));

  // Fechar a janela principal apenas oculta, não encerra o servidor
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    updateServerInfo(serverIp);
  });
}

function startServerProcess() {
  if (serverProcess) {
    serverProcess.kill("SIGKILL");
    serverProcess = null;
  }

  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    silent: false,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  serverProcess.on("message", (message) => {
    if (message.type === "log") {
      sendLogToWindow(message.message);
    } else if (message.type === "status") {
      updateStatusDisplay(message.message);
    } else if (message.type === "server-ip") {
      updateServerInfo(message.ip);
    }
  });

  sendLogToWindow(
    ">>> Processo do Servidor (server.js) iniciado como processo filho."
  );
}

app.whenReady().then(() => {
  createMainWindow();
  startServerProcess();

  // Cria o menu de contexto apenas para remover o menu padrão do Electron
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]));
  }

  tray = new Tray(path.join(__dirname, "icon.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mostrar/Esconder Status",
      click: () => {
        createMainWindow();
      },
    },
    {
      label: "Reiniciar Servidor",
      click: () => {
        sendLogToWindow(
          "Ação: Reiniciando servidor através do menu de contexto..."
        );
        startServerProcess();
      },
    },
    { type: "separator" },
    { label: "Sair", click: () => app.quit() },
  ]);

  tray.setToolTip("Servidor do Dashboard ETS2");
  tray.setContextMenu(contextMenu);
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  if (serverProcess) {
    sendLogToWindow(
      "Encerrando processo do servidor antes de fechar o Electron."
    );
    serverProcess.kill("SIGKILL");
  }
  app.isQuitting = true;
});

// --- HANDLERS IPC PARA CONTROLE DA JANELA E REINÍCIO ---

// 1. Recebe comandos de controle da janela do status_renderer.js
ipcMain.on("window-control", (event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  switch (action) {
    case "minimize":
      mainWindow.minimize();
      break;
    case "maximize":
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case "close":
      mainWindow.close(); // Isso aciona o evento 'close' e oculta a janela
      break;
  }
});

// 2. Reinicia o servidor
ipcMain.on("restart-server", () => {
  startServerProcess();
});

// 3. Responde à solicitação de informações da janela de status
ipcMain.on("ready-for-info", (event) => {
  event.reply("server-info", {
    serverIp: serverIp,
    port: 3000,
  });
});
