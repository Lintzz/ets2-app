// ETS2_DashboardFixo/hooks/useTelemetry.js

import { useEffect, useRef, useState } from "react";
import dgram from "react-native-udp";

const UDP_PORT = 48888;

export function useTelemetry() {
  const [serverUrl, setServerUrl] = useState(null);
  const [ws, setWs] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const udpSocketRef = useRef(null);

  useEffect(() => {
    if (serverUrl) return;

    const udpSocket = dgram.createSocket("udp4");
    udpSocketRef.current = udpSocket;
    udpSocket.bind(UDP_PORT);

    udpSocket.on("listening", () =>
      console.log("A escutar por transmissões do servidor...")
    );
    udpSocket.on("message", (msg) => {
      try {
        const { serverIp, port } = JSON.parse(msg.toString());
        const url = `ws://${serverIp}:${port}`;
        if (!serverUrl) {
          console.log(`Servidor encontrado em: ${url}`);
          setServerUrl(url);
          udpSocket.close();
        }
      } catch (e) {
        console.error("Erro UDP:", e);
      }
    });
    return () => {
      if (udpSocketRef.current) udpSocketRef.current.close();
    };
  }, [serverUrl]);

  useEffect(() => {
    if (serverUrl && !ws) {
      console.log("Tentando conectar via WebSocket...");
      const newWs = new WebSocket(serverUrl);
      setWs(newWs);

      newWs.onopen = () => {
        setIsConnected(true);
        console.log("Conexão WebSocket estabelecida com sucesso!");
      };

      newWs.onclose = () => {
        setIsConnected(false);
        setServerUrl(null);
        setTelemetry(null);
        setWs(null); // Reseta o estado do WebSocket para permitir uma nova tentativa
        console.log(
          "Conexão WebSocket fechada. A procurar servidor novamente..."
        );
      };

      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetry(data);
        } catch (e) {
          console.error("Erro ao processar dados de telemetria:", e);
        }
      };

      newWs.onerror = (e) => {
        console.error("Erro WebSocket:", e.message);
        setIsConnected(false);
        setServerUrl(null);
        setTelemetry(null);
        setWs(null); // Reseta o estado do WebSocket em caso de erro
      };
    }

    return () => {
      if (ws) {
        ws.close();
        setWs(null);
      }
    };
  }, [serverUrl, ws]);

  const sendCommand = (type, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  };

  const pressKey = (key) => sendCommand("press_key", key);
  const holdKeyDown = (key) => sendCommand("hold_key_down", key);
  const holdKeyUp = (key) => sendCommand("hold_key_up", key);

  return {
    serverUrl,
    isConnected,
    telemetry,
    pressKey,
    holdKeyDown,
    holdKeyUp,
  };
}
