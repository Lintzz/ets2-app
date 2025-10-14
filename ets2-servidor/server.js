// ETS2_Servidor/server.js

const http = require("http");
const dgram = require("dgram");
const { networkInterfaces } = require("os");
const WebSocket = require("ws");
const leitorMemoria = require("./build/Release/leitor_memoria");
const robot = require("robotjs");

const DISCOVERY_PORT = 48888;
const TCP_PORT = 3000;

// Envia uma mensagem inicial para o processo principal do Electron
process.send({
  type: "log",
  message: "================================================",
});
process.send({
  type: "log",
  message: "        SERVIDOR DO DASHBOARD ETS2 INICIADO",
});
process.send({
  type: "log",
  message: "================================================\n",
});

// --- SERVIDOR HTTP E WEBSOCKET ---
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clientConnected = false;
let telemetryInterval = null;
let lastTelemetryData = null;
let lastChangeTimestamp = Date.now();
const INACTIVITY_TIMEOUT = 30000; // 30 segundos

wss.on("connection", (ws) => {
  clientConnected = true;
  const clientIp = ws._socket.remoteAddress;
  process.send({
    type: "log",
    message: `\n>>> Tablet conectado com sucesso! (IP do cliente: ${clientIp}) <<<\n`,
  });

  if (telemetryInterval) clearInterval(telemetryInterval);

  telemetryInterval = setInterval(() => {
    const telemetryData = leitorMemoria.lerDados();

    let statusMessage = "Aguardando conexão do tablet...";

    if (telemetryData) {
      // Atualiza o timestamp da última alteração se os dados mudarem
      if (JSON.stringify(telemetryData) !== JSON.stringify(lastTelemetryData)) {
        lastTelemetryData = telemetryData;
        lastChangeTimestamp = Date.now();
      }
      const isInactive = Date.now() - lastChangeTimestamp > INACTIVITY_TIMEOUT;

      // Se o jogo está rodando ativamente e não está inativo, envia todos os dados
      if (telemetryData.jogoRodando && !isInactive) {
        statusMessage = "Dados do jogo encontrados! A transmitir... ✅";
        ws.send(JSON.stringify(telemetryData));
      } else {
        // Se o jogo está no menu ou pausado, envia um objeto mínimo para manter a conexão
        statusMessage = "Jogo no menu ou pausado. Conexão mantida. ⏸️";
        // Enviamos um objeto com o estado atual para que o cliente saiba que está no menu
        ws.send(JSON.stringify({ jogoRodando: false, inMenu: true }));
      }
    } else {
      // Se não há dados, o jogo provavelmente está fechado
      statusMessage = "Jogo (ETS2) não detectado. Aguardando... 🛑";
      ws.send(JSON.stringify(null));
    }

    process.send({ type: "status", message: statusMessage });
  }, 250);

  // --- LÓGICA DE CONTROLES E DESCONEXÃO ---
  ws.on("message", (message) => {
    try {
      const { type, payload } = JSON.parse(message);

      let keyAction = "";
      if (type === "press_key") {
        robot.keyTap(payload);
        keyAction = `Tecla pressionada: ${payload}`;
      }
      if (type === "hold_key_down") {
        robot.keyToggle(payload, "down");
        keyAction = `Tecla mantida (DOWN): ${payload}`;
      }
      if (type === "hold_key_up") {
        robot.keyToggle(payload, "up");
        keyAction = `Tecla liberada (UP): ${payload}`;
      }

      if (keyAction) {
        process.send({ type: "log", message: `Ação Remota: ${keyAction}` });
      }
    } catch (e) {
      process.send({
        type: "log",
        message: `Erro ao processar mensagem do cliente: ${e}`,
      });
    }
  });

  ws.on("close", () => {
    clientConnected = false;
    clearInterval(telemetryInterval);
    telemetryInterval = null;
    process.send({
      type: "log",
      message: "\n>>> Tablet desconectado. Parando a transmissão. <<<\n",
    });
    process.send({
      type: "status",
      message: "Aguardando conexão do tablet...  ",
    });
  });
});

server.listen(TCP_PORT, "0.0.0.0", () => {
  process.send({
    type: "log",
    message: `Servidor TCP a correr na porta ${TCP_PORT} e a aceitar conexões de rede.`,
  });
  process.send({
    type: "status",
    message: "Aguardando conexão do tablet...  ",
  });
});

// --- SERVIDOR DE DESCOBERTA (UDP) ---
const discoverySocket = dgram.createSocket("udp4");
const interfaces = networkInterfaces();
const addresses = [];

for (const name of Object.keys(interfaces)) {
  for (const net of interfaces[name]) {
    if (net.family === "IPv4" && !net.internal) {
      addresses.push(net.address);
    }
  }
}

discoverySocket.on("listening", () => {
  process.send({
    type: "log",
    message: "Servidor de descoberta UDP a transmitir em todas as redes.",
  });
});

discoverySocket.bind(DISCOVERY_PORT, () => {
  discoverySocket.setBroadcast(true);

  const localIp = addresses.length > 0 ? addresses[0] : "127.0.0.1";
  process.send({ type: "server-ip", ip: localIp });

  setInterval(() => {
    if (clientConnected) return;
    addresses.forEach((ip) => {
      const message = Buffer.from(
        JSON.stringify({ serverIp: ip, port: TCP_PORT })
      );
      const broadcastAddress = ip.substring(0, ip.lastIndexOf(".")) + ".255";
      discoverySocket.send(
        message,
        0,
        message.length,
        DISCOVERY_PORT,
        broadcastAddress
      );
    });
  }, 2000);
});
