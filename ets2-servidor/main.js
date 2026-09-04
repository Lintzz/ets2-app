const { app, Tray, Menu, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const { garantirRegras } = require("./firewall");
const { TCP_PORT } = require("./protocolo");
const {
  detectarPastasETS2,
  instalarPlugin,
  statusInstalacao,
} = require("./instalador-plugin");
const { melhorDllDisponivel } = require("./plugin-remoto");
const registro = require("./registro");
const { iniciarAtualizacoes } = require("./atualizador");

if (require("electron-squirrel-startup")) app.quit();

// Variáveis globais
let tray = null;
let mainWindow = null;
let serverProcess = null;

const info = {
  serverIp: "Aguardando...",
  enderecos: [],
  port: TCP_PORT,
  clienteIp: null,
  clienteNome: null,
  pareado: null,
  codigo: null,
  codigoExpiraEm: null,
};

// --- Funções de Comunicação ---
function enviarParaJanela(canal, dados) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(canal, dados);
  }
}

// Tudo que vai para a janela vai também para o arquivo: a janela mostra só a
// sessão atual, o arquivo é o que dá para pedir a quem relata um problema.
const sendLogToWindow = (message) => {
  registro.escrever(message);
  enviarParaJanela("server-log", message);
};

const updateStatusDisplay = (message) => {
  registro.escrever(`Status: ${message}`);
  enviarParaJanela("server-status", message);
};
const enviarInformacoes = () => enviarParaJanela("server-info", info);

// --- Lógica Principal da Aplicação ---
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    title: "ETS2 Server Status",
    // Empacotado o ícone vem do .exe, mas em desenvolvimento a janela ficava
    // com o ícone padrão do Electron na barra de tarefas.
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
    show: false,
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "status.html"));

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Fechar a janela principal apenas oculta, não encerra o servidor
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on("did-finish-load", enviarInformacoes);
}

function startServerProcess() {
  if (serverProcess) {
    serverProcess.kill("SIGKILL");
    serverProcess = null;
  }

  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    silent: false,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    env: {
      ...process.env,
      // O server.js guarda o pareamento aqui. Dentro do asar empacotado o
      // __dirname é somente-leitura, então precisa ser o userData.
      ETS2_USER_DATA: app.getPath("userData"),
    },
  });

  serverProcess.on("message", (message) => {
    switch (message.type) {
      case "log":
        sendLogToWindow(message.message);
        break;
      case "status":
        updateStatusDisplay(message.message);
        break;
      case "server-ip":
        info.serverIp = message.ip;
        info.enderecos = message.enderecos || [];
        info.port = message.port || TCP_PORT;
        enviarInformacoes();
        break;
      case "cliente":
        info.clienteIp = message.ip;
        info.clienteNome = message.nome || null;
        enviarInformacoes();
        break;
      case "pareamento":
        info.pareado = message.pareado;
        enviarInformacoes();
        break;
      case "codigo":
        info.codigo = message.codigo;
        info.codigoExpiraEm = message.expiraEm;
        enviarInformacoes();
        break;
    }
  });

  serverProcess.on("exit", (code, signal) => {
    if (!app.isQuitting && signal !== "SIGKILL") {
      sendLogToWindow(`Servidor encerrou inesperadamente (código ${code}).`);
    }
  });

  sendLogToWindow(">>> Processo do Servidor (server.js) iniciado como processo filho.");
}

async function configurarFirewall() {
  const r = await garantirRegras();

  for (const nome of r.criadas) {
    sendLogToWindow(`Firewall: regra "${nome}" criada.`);
  }
  if (r.corrigidas.length > 0) {
    sendLogToWindow(
      `Firewall: regras limitadas às redes Particular/Domínio (${r.corrigidas.join(", ")}).`
    );
  }
  if (r.jaExistiam.length > 0) {
    sendLogToWindow(`Firewall: regras já configuradas (${r.jaExistiam.join(", ")}).`);
  }
  for (const falha of r.falharam) {
    sendLogToWindow(
      `Firewall: não foi possível criar "${falha.nome}" (precisa de administrador). ` +
        `Abra o Prompt como admin e rode: ${falha.comando}`
    );
  }
}

app.whenReady().then(() => {
  registro.iniciar(app.getPath("userData"), app.getVersion());
  createMainWindow();
  startServerProcess();
  configurarFirewall();
  iniciarAtualizacoes(sendLogToWindow);

  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]));
  }

  // O .ico traz todos os tamanhos (16 a 256) já ajustados: deixar o Windows
  // reduzir o PNG de 512 apagava o traço fino do mostrador na bandeja.
  tray = new Tray(
    path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png")
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mostrar/Esconder Status",
      click: () => createMainWindow(),
    },
    {
      label: "Reiniciar Servidor",
      click: () => {
        sendLogToWindow("Ação: Reiniciando servidor através do menu de contexto...");
        startServerProcess();
      },
    },
    {
      label: "Esquecer aparelho pareado",
      click: () => esquecerPareamento(),
    },
    { type: "separator" },
    { label: "Sair", click: () => app.quit() },
  ]);

  tray.setToolTip("Servidor do Dashboard ETS2");
  tray.setContextMenu(contextMenu);
});

function esquecerPareamento() {
  if (!serverProcess) return;
  serverProcess.send({ type: "esquecer-pareamento" });
  sendLogToWindow("Ação: apagando o aparelho pareado...");
}

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess) {
    sendLogToWindow("Encerrando processo do servidor antes de fechar o Electron.");
    serverProcess.kill("SIGKILL");
  }
});

// --- INSTALAÇÃO DO PLUGIN NO JOGO ---

// DLL que acompanha o instalador. Empacotada vai como extraResource; em
// desenvolvimento fica em recursos/. Serve de plano B quando não há internet.
function dllEmbutida() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "PluginETS2.dll")
    : path.join(__dirname, "recursos", "PluginETS2.dll");
}

const PASTA_CACHE_PLUGIN = () => path.join(app.getPath("userData"), "plugin-cache");

// Resolvida uma vez por execução: a DLL da última release do repositório do
// plugin, ou a embutida se o GitHub não estiver acessível.
let dllResolvida = null;

async function caminhoDaDll({ forcarNovaBusca = false } = {}) {
  if (dllResolvida && !forcarNovaBusca) return dllResolvida;

  dllResolvida = await melhorDllDisponivel(dllEmbutida(), PASTA_CACHE_PLUGIN());
  sendLogToWindow(`Plugin: ${dllResolvida.motivo}`);
  return dllResolvida;
}

const ARQUIVO_CONFIG = () => path.join(app.getPath("userData"), "config.json");

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_CONFIG(), "utf8"));
  } catch {
    return {};
  }
}

function salvarConfig(novo) {
  try {
    fs.writeFileSync(ARQUIVO_CONFIG(), JSON.stringify({ ...lerConfig(), ...novo }, null, 2));
  } catch (e) {
    sendLogToWindow(`Não foi possível salvar a configuração: ${e.message}`);
  }
}

// Pasta em uso: a que o usuário escolheu antes, ou a primeira detectada.
async function pastaAtualDoJogo() {
  const salva = lerConfig().pastaETS2;
  if (salva && statusInstalacao(salva, dllEmbutida()).valida) return salva;

  const detectadas = await detectarPastasETS2();
  return detectadas[0] || null;
}

async function estadoDoPlugin(opcoes) {
  const [pasta, detectadas, dll] = await Promise.all([
    pastaAtualDoJogo(),
    detectarPastasETS2(),
    caminhoDaDll(opcoes),
  ]);

  const base = {
    detectadas,
    dll: dll.caminho,
    origem: dll.origem,
    motivo: dll.motivo,
    tag: dll.release ? dll.release.tag : null,
    paginaRelease: dll.release ? dll.release.pagina : null,
  };

  if (!pasta) return { ...base, valida: false, pastaJogo: null };
  return { ...base, ...statusInstalacao(pasta, dll.caminho) };
}

// --- HANDLERS IPC ---

ipcMain.on("window-control", (event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  switch (action) {
    case "minimize":
      mainWindow.minimize();
      break;
    case "maximize":
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
      break;
    case "close":
      mainWindow.close();
      break;
  }
});

ipcMain.on("restart-server", () => startServerProcess());

ipcMain.on("esquecer-pareamento", () => esquecerPareamento());

ipcMain.on("novo-codigo", () => {
  if (!serverProcess) return;
  serverProcess.send({ type: "novo-codigo" });
});

ipcMain.on("ready-for-info", () => enviarInformacoes());

// Só para o selo de versão na barra de título.
ipcMain.handle("app:versao", () => app.getVersion());

ipcMain.handle("app:abrir-logs", async () => {
  const pasta = registro.caminhoDaPasta();
  if (!pasta) return false;
  await shell.openPath(pasta);
  return true;
});

// --- HANDLERS IPC DO INSTALADOR DE PLUGIN ---

ipcMain.handle("plugin:estado", () => estadoDoPlugin());

ipcMain.handle("plugin:escolher-pasta", async () => {
  const escolha = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione a pasta do Euro Truck Simulator 2",
    properties: ["openDirectory"],
    defaultPath: (await pastaAtualDoJogo()) || undefined,
    buttonLabel: "Usar esta pasta",
  });

  if (escolha.canceled || escolha.filePaths.length === 0) return estadoDoPlugin();

  const pasta = escolha.filePaths[0];
  const status = statusInstalacao(pasta, (await caminhoDaDll()).caminho);

  if (!status.valida) {
    sendLogToWindow(
      `A pasta escolhida não parece ser a do ETS2: ${pasta} ` +
        "(esperava encontrar bin\win_x64\eurotrucks2.exe)."
    );
    return { ...(await estadoDoPlugin()), erro: "pasta-invalida" };
  }

  salvarConfig({ pastaETS2: pasta });
  sendLogToWindow(`Pasta do ETS2 definida: ${pasta}`);
  return estadoDoPlugin();
});

ipcMain.handle("plugin:instalar", async () => {
  const pasta = await pastaAtualDoJogo();
  if (!pasta) {
    return { ok: false, mensagem: "Escolha primeiro a pasta do Euro Truck Simulator 2." };
  }

  const dll = await caminhoDaDll();
  const resultado = instalarPlugin(pasta, dll.caminho);
  sendLogToWindow(
    resultado.ok
      ? `Plugin: ${resultado.mensagem} (${resultado.destino})`
      : `Plugin: ${resultado.mensagem}`
  );

  if (resultado.ok) salvarConfig({ pastaETS2: pasta });
  return { ...resultado, origem: dll.origem, tag: dll.release?.tag, estado: await estadoDoPlugin() };
});

// Reconsulta a release, ignorando o que já foi resolvido nesta execução.
ipcMain.handle("plugin:verificar-atualizacao", () =>
  estadoDoPlugin({ forcarNovaBusca: true })
);

ipcMain.handle("plugin:abrir-pasta", async () => {
  const pasta = await pastaAtualDoJogo();
  if (pasta) shell.openPath(path.join(pasta, "bin", "win_x64", "plugins"));
});
