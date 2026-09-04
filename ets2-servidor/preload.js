// ETS2_Servidor/preload.js
// Ponte entre o processo principal e a janela de status. Substitui o antigo
// nodeIntegration:true / contextIsolation:false — a janela não tem mais acesso
// direto ao Node, só a estes canais.

const { contextBridge, ipcRenderer } = require("electron");

const inscrever = (canal) => (callback) => {
  const handler = (_evento, dados) => callback(dados);
  ipcRenderer.on(canal, handler);
  return () => ipcRenderer.removeListener(canal, handler);
};

contextBridge.exposeInMainWorld("servidor", {
  // Janela
  minimizar: () => ipcRenderer.send("window-control", "minimize"),
  maximizar: () => ipcRenderer.send("window-control", "maximize"),
  fechar: () => ipcRenderer.send("window-control", "close"),

  // Ações
  reiniciar: () => ipcRenderer.send("restart-server"),
  esquecerAparelho: () => ipcRenderer.send("esquecer-pareamento"),
  pedirInformacoes: () => ipcRenderer.send("ready-for-info"),
  versao: () => ipcRenderer.invoke("app:versao"),

  // Instalação do plugin no jogo
  plugin: {
    estado: () => ipcRenderer.invoke("plugin:estado"),
    escolherPasta: () => ipcRenderer.invoke("plugin:escolher-pasta"),
    instalar: () => ipcRenderer.invoke("plugin:instalar"),
    abrirPasta: () => ipcRenderer.invoke("plugin:abrir-pasta"),
    verificarAtualizacao: () => ipcRenderer.invoke("plugin:verificar-atualizacao"),
  },

  // Eventos
  aoReceberLog: inscrever("server-log"),
  aoMudarStatus: inscrever("server-status"),
  aoReceberInformacoes: inscrever("server-info"),
});
