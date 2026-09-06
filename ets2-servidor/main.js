const { app, Tray, Menu, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const {
  garantirRegras,
  garantirRegrasElevado,
  estadoDasRegras,
} = require("./firewall");
const { TCP_PORT } = require("./protocolo");
const {
  detectarPastasETS2,
  instalarPlugin,
  statusInstalacao,
} = require("./instalador-plugin");
const { melhorDllDisponivel } = require("./plugin-remoto");
const { estadoDoApk } = require("./app-remoto");
const registro = require("./registro");
const { iniciarAtualizacoes } = require("./atualizador");
const { painelParaJanela, avaliarPainel, definirLayout } = require("./painel");
const layouts = require("./layouts");

if (require("electron-squirrel-startup")) app.quit();

// Só um servidor por vez. Fechar a janela apenas a esconde, então quem clicava
// no atalho de novo abria outro processo inteiro: mais um ícone na bandeja, e um
// server.js filho que morria na hora com EADDRINUSE na porta 3000 ("Servidor
// encerrou inesperadamente (código 1)" no log). Com vários escondidos, ninguém
// percebia.
const instanciaUnica = app.requestSingleInstanceLock();

// app.quit() e assincrono: sem o guarda no whenReady abaixo, a segunda instancia
// ainda chegava a abrir o log e a dar fork no server.js antes de morrer.
if (!instanciaUnica) app.quit();

// Variáveis globais
let tray = null;
let mainWindow = null;
let dashboardWindow = null;
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

// A telemetria só interessa à janela do painel; a de status recebe apenas a frase
// de estado derivada, como sempre recebeu.
function enviarParaDashboard(canal, dados) {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send(canal, dados);
  }
}

// Ponto único por onde o layout ativo se espalha: para o espelho (painel.js) e
// para o tablet (server.js). Também é reenviado a cada fork, porque um servidor
// recém-nascido não sabe qual preset está valendo.
function aplicarLayoutAtivo({ recarregarJanela = true } = {}) {
  const ativo = layouts.layoutAtivo();

  for (const erro of ativo.erros || []) sendLogToWindow(`Layout: ${erro}`);

  definirLayout(ativo.widgets, ativo.tela);
  if (serverProcess && serverProcess.connected) {
    serverProcess.send({
      type: "layout",
      nome: ativo.nome,
      tela: ativo.tela || null,
      widgets: ativo.widgets,
    });
  }
  // A janela monta os widgets uma vez, no carregamento: para trocar de layout ela
  // precisa remontar.
  if (recarregarJanela && dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.reload();
  }
  return ativo;
}

// O server.js só liga o loop de telemetria quando alguém precisa dele. Precisa ser
// reavisado a cada fork, senão um "Reiniciar Servidor" com a janela aberta deixa o
// painel congelado.
function avisarPreview(ativo) {
  // `connected` porque ao sair do app o servidor é morto antes das janelas
  // fecharem, e o "closed" da janela do painel cairia num canal IPC já fechado.
  if (serverProcess && serverProcess.connected) {
    serverProcess.send({ type: "preview", ativo });
  }
}

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
    title: "Dashlz",
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

// Espelho do painel do tablet. Desenha o mesmo layout, a partir do mesmo catálogo
// em compartilhado/, e o anima com a telemetria real — inclusive sem tablet
// nenhum conectado, que é quando se está conferindo o layout no PC. É só leitura:
// não há caminho daqui para o robotjs.
function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore();
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 440,
    title: "Dashlz — Painel",
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
    show: false,
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    backgroundColor: "#0F1014",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  dashboardWindow.loadFile(path.join(__dirname, "dashboard.html"));
  dashboardWindow.once("ready-to-show", () => dashboardWindow.show());

  // Esta fecha de verdade, ao contrário da de status: com ela fechada e sem
  // tablet, o servidor volta a não ler a memória compartilhada.
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
    avisarPreview(false);
  });

  avisarPreview(true);
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
      case "telemetria":
        // A janela recebe só o estado de cada widget: o catálogo e o avaliador
        // ficam aqui, do lado que tem Node.
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          enviarParaDashboard("dashboard-telemetria", avaliarPainel(message.payload));
        }
        break;
    }
  });

  // Um servidor recém-nascido não sabe que a janela do painel está aberta, nem
  // qual layout está ativo.
  if (dashboardWindow && !dashboardWindow.isDestroyed()) avisarPreview(true);
  aplicarLayoutAtivo({ recarregarJanela: false });

  serverProcess.on("exit", (code, signal) => {
    if (!app.isQuitting && signal !== "SIGKILL") {
      sendLogToWindow(`Servidor encerrou inesperadamente (código ${code}).`);
    }
  });

  sendLogToWindow(">>> Processo do Servidor (server.js) iniciado como processo filho.");
}

function relatarFirewall(r) {
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

// Criar as regras precisa de administrador, e o app roda como usuário comum de
// propósito (o instalador Squirrel é por usuário, e subir o servidor e o robotjs
// elevados não faz falta nenhuma). Então, quando falta regra, pedimos o UAC só
// para os netsh — uma janela, uma vez.
//
// Quem cancelar o UAC não é perguntado de novo: a recusa fica no config.json e
// sobra o botão "Liberar no Firewall" da janela de status, que chama isto com
// `forcar` e limpa a recusa.
async function configurarFirewall({ forcar = false } = {}) {
  if (forcar) salvarConfig({ firewallElevacaoRecusada: false });

  const podePedirAdmin = forcar || lerConfig().firewallElevacaoRecusada !== true;

  const r = podePedirAdmin
    ? await garantirRegrasElevado(() =>
        sendLogToWindow(
          "Firewall: pedindo permissão de administrador para liberar as portas..."
        )
      )
    : await garantirRegras();

  relatarFirewall(r);

  if (r.recusado) {
    salvarConfig({ firewallElevacaoRecusada: true });
    sendLogToWindow(
      'Firewall: permissão negada. Use o botão "Liberar no Firewall" na janela ' +
        "de status quando quiser tentar de novo."
    );
  } else if (!podePedirAdmin && r.falharam.length > 0) {
    sendLogToWindow(
      'Firewall: faltam regras. Clique em "Liberar no Firewall" na janela de status.'
    );
  }

  const estado = await estadoDasRegras();
  // A janela consulta o estado sozinha ao abrir, mas isso pode acontecer antes de
  // o UAC ser respondido; sem este aviso o cartão ficaria na tela depois de as
  // regras já terem sido criadas.
  enviarParaJanela("firewall-estado", estado);
  return estado;
}

app.whenReady().then(() => {
  if (!instanciaUnica) return;

  // Segunda tentativa de abrir: em vez de subir outro servidor, traz para a
  // frente a janela que já existe.
  app.on("second-instance", () => createMainWindow());

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
      label: "Abrir Painel",
      click: () => createDashboardWindow(),
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

  tray.setToolTip("Dashlz — servidor do dashboard");
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
    tag: dll.release ? dll.release.versao : null,
    paginaRelease: dll.release ? dll.release.pagina : null,
  };

  if (!pasta) return { ...base, valida: false, pastaJogo: null };
  return { ...base, ...statusInstalacao(pasta, dll.caminho) };
}

// --- HANDLERS IPC ---

// Pela janela que mandou, não pela mainWindow: são duas agora, e as duas são
// frameless, com os botões desenhados em HTML.
ipcMain.on("window-control", (event, action) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  if (!janela || janela.isDestroyed()) return;

  switch (action) {
    case "minimize":
      janela.minimize();
      break;
    case "maximize":
      if (janela.isMaximized()) janela.unmaximize();
      else janela.maximize();
      break;
    case "close":
      janela.close();
      break;
  }
});

ipcMain.on("abrir-dashboard", () => createDashboardWindow());

ipcMain.handle("dashboard:painel", () => painelParaJanela());

// --- Layouts do painel ---
//
// Todos devolvem o estado novo junto, no formato { ok, mensagem, ... } dos demais
// handlers, para o renderer repintar sem uma segunda ida ao main.
const responderLayout = (r) => {
  if (r.mensagem) sendLogToWindow(`Layout: ${r.mensagem}`);
  if (r.ok) aplicarLayoutAtivo();
  return { ...r, estado: layouts.estado() };
};

ipcMain.handle("layout:estado", () => layouts.estado());
ipcMain.handle("layout:ativar", (_e, id) => responderLayout(layouts.ativar(id)));
ipcMain.handle("layout:duplicar", (_e, id, nome) => responderLayout(layouts.duplicar(id, nome)));
ipcMain.handle("layout:renomear", (_e, id, nome) => responderLayout(layouts.renomear(id, nome)));
ipcMain.handle("layout:excluir", (_e, id) => responderLayout(layouts.excluir(id)));

// Salvar não recarrega a janela: o editor já tem a tela do jeito que o usuário
// montou, e recarregar jogaria fora a seleção e o histórico de desfazer.
ipcMain.handle("layout:salvar", (_e, id, widgets, tela) => {
  const r = layouts.salvarWidgets(id, widgets, tela);
  if (r.mensagem) sendLogToWindow(`Layout: ${r.mensagem}`);
  if (r.ok) aplicarLayoutAtivo({ recarregarJanela: false });
  return { ...r, estado: layouts.estado() };
});

ipcMain.on("restart-server", () => startServerProcess());

ipcMain.on("esquecer-pareamento", () => esquecerPareamento());

ipcMain.on("novo-codigo", () => {
  if (!serverProcess) return;
  serverProcess.send({ type: "novo-codigo" });
});

ipcMain.on("ready-for-info", () => enviarInformacoes());

// Só para o selo de versão na barra de título.
ipcMain.handle("firewall:estado", () => estadoDasRegras());

ipcMain.handle("firewall:liberar", () => configurarFirewall({ forcar: true }));

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
  return { ...resultado, origem: dll.origem, tag: dll.release?.versao, estado: await estadoDoPlugin() };
});

// Reconsulta a release, ignorando o que já foi resolvido nesta execução.
ipcMain.handle("plugin:verificar-atualizacao", () =>
  estadoDoPlugin({ forcarNovaBusca: true })
);

// --- HANDLERS IPC DO APK DO TABLET ---

// Resolvido uma vez por execução, como a DLL: quem abre a janela toda hora não
// precisa de uma consulta nova ao GitHub a cada vez.
let apkResolvido = null;

async function apkDoTablet({ forcarNovaBusca = false } = {}) {
  if (apkResolvido && !forcarNovaBusca) return apkResolvido;

  apkResolvido = await estadoDoApk();
  sendLogToWindow(`Aplicativo: ${apkResolvido.motivo}`);
  return apkResolvido;
}

ipcMain.handle("apk:estado", () => apkDoTablet());

ipcMain.handle("apk:verificar", () => apkDoTablet({ forcarNovaBusca: true }));

// Abre a página da release no navegador do PC — a saída para quem prefere
// baixar por aqui e passar o arquivo por cabo.
ipcMain.handle("apk:abrir-pagina", async () => {
  const apk = await apkDoTablet();
  if (apk.pagina) await shell.openExternal(apk.pagina);
});

ipcMain.handle("plugin:abrir-pasta", async () => {
  const pasta = await pastaAtualDoJogo();
  if (pasta) shell.openPath(path.join(pasta, "bin", "win_x64", "plugins"));
});
