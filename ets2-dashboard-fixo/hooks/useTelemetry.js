// ETS2_DashboardFixo/hooks/useTelemetry.js

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { identificar, varrerSubRede } from "./descoberta";
import {
  BACKOFF_MS,
  CHAVE_DEVICE_ID,
  CHAVE_ULTIMO_IP,
  TCP_PORT,
  TIMEOUT_IP_CONHECIDO_MS,
} from "./protocolo";

// Estados possíveis: "iniciando" | "procurando" | "conectando" | "conectado"
//                    | "recusado" | "sem-servidor"
const nomeDoAparelho = () => {
  const modelo = Platform.constants?.Model || Platform.constants?.Brand;
  return modelo ? String(modelo) : `Dashboard ${Platform.OS}`;
};

async function obterDeviceId() {
  let id = await AsyncStorage.getItem(CHAVE_DEVICE_ID);
  if (!id) {
    // Identidade estável deste aparelho, usada pelo pareamento do servidor.
    id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(CHAVE_DEVICE_ID, id);
  }
  return id;
}

export function useTelemetry() {
  const [estado, setEstado] = useState("iniciando");
  const [telemetry, setTelemetry] = useState(null);
  const [servidor, setServidor] = useState(null);
  const [progresso, setProgresso] = useState(null);

  // Tudo que não precisa redesenhar a tela vive em ref: a versão anterior
  // guardava o WebSocket em estado e o próprio efeito o alterava, o que fazia
  // o efeito se re-disparar em cadeia e reabrir a conexão sem parar.
  const wsRef = useRef(null);
  const deviceIdRef = useRef(null);
  const tentativaRef = useRef(0);
  const timerRef = useRef(null);
  const buscaRef = useRef(null);
  const desmontadoRef = useRef(false);
  const estadoRef = useRef("iniciando");

  // setEstado + espelho em ref: o onclose precisa saber o estado atual sem
  // executar efeito colateral dentro de um updater do React.
  const mudarEstado = (novo) => {
    estadoRef.current = novo;
    setEstado(novo);
  };

  const limparTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const fecharSocket = () => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
    try {
      ws.close();
    } catch {
      /* já estava fechado */
    }
  };

  // --- Conexão ---------------------------------------------------------------

  const conectar = useCallback((alvo) => {
    if (desmontadoRef.current) return;

    fecharSocket();
    mudarEstado("conectando");
    setServidor(alvo);

    const ws = new WebSocket(`ws://${alvo.ip}:${alvo.port || TCP_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          deviceId: deviceIdRef.current,
          nome: nomeDoAparelho(),
        })
      );
    };

    ws.onmessage = (evento) => {
      let dados;
      try {
        dados = JSON.parse(evento.data);
      } catch {
        return;
      }

      // Handshake
      if (dados && dados.type === "welcome") {
        tentativaRef.current = 0;
        mudarEstado("conectado");
        AsyncStorage.setItem(CHAVE_ULTIMO_IP, JSON.stringify(alvo)).catch(() => {});
        return;
      }
      if (dados && dados.type === "denied") {
        mudarEstado("recusado");
        fecharSocket();
        return;
      }

      setTelemetry(dados);
    };

    ws.onerror = () => {
      // O onclose logo em seguida cuida da reconexão.
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // socket já substituído
      wsRef.current = null;
      setTelemetry(null);

      // "recusado" é decisão do servidor: reconectar em loop não adianta,
      // o usuário precisa liberar o pareamento no PC.
      if (estadoRef.current === "recusado") return;
      mudarEstado("procurando");
      agendarNovaBusca();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Busca -----------------------------------------------------------------

  const procurar = useCallback(async () => {
    if (desmontadoRef.current) return;

    const sinal = { cancelado: false };
    buscaRef.current?.cancelar?.();
    buscaRef.current = { cancelar: () => (sinal.cancelado = true) };

    mudarEstado("procurando");
    setProgresso(null);

    // 1. O último servidor usado costuma ser o mesmo — evita varrer 254 IPs.
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_ULTIMO_IP);
      if (bruto) {
        const anterior = JSON.parse(bruto);
        const confirmado = await identificar(
          anterior.ip,
          TIMEOUT_IP_CONHECIDO_MS,
          anterior.port || TCP_PORT
        );
        if (confirmado && !sinal.cancelado) {
          conectar(confirmado);
          return;
        }
      }
    } catch {
      /* sem servidor salvo */
    }

    if (sinal.cancelado) return;

    // 2. Varredura da sub-rede.
    const encontrado = await varrerSubRede({ sinal, onProgresso: setProgresso });
    if (sinal.cancelado || desmontadoRef.current) return;

    setProgresso(null);
    if (encontrado) {
      conectar(encontrado);
    } else {
      mudarEstado("sem-servidor");
      agendarNovaBusca();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectar]);

  // Backoff progressivo: a versão anterior reiniciava a descoberta num laço
  // apertado enquanto o servidor estivesse fora do ar.
  function agendarNovaBusca() {
    limparTimer();
    const espera = BACKOFF_MS[Math.min(tentativaRef.current, BACKOFF_MS.length - 1)];
    tentativaRef.current += 1;
    timerRef.current = setTimeout(() => {
      if (!desmontadoRef.current) procurar();
    }, espera);
  }

  // --- Ciclo de vida ---------------------------------------------------------

  useEffect(() => {
    desmontadoRef.current = false;

    obterDeviceId()
      .then((id) => {
        deviceIdRef.current = id;
        procurar();
      })
      .catch(() => mudarEstado("sem-servidor"));

    return () => {
      desmontadoRef.current = true;
      limparTimer();
      buscaRef.current?.cancelar?.();
      fecharSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Ações expostas --------------------------------------------------------

  const conectarManual = useCallback(
    async (ip, porta = TCP_PORT) => {
      buscaRef.current?.cancelar?.();
      limparTimer();
      mudarEstado("conectando");

      const alvo = await identificar(ip, TIMEOUT_IP_CONHECIDO_MS, porta);
      if (alvo) {
        tentativaRef.current = 0;
        conectar(alvo);
        return true;
      }
      mudarEstado("sem-servidor");
      return false;
    },
    [conectar]
  );

  const procurarNovamente = useCallback(() => {
    tentativaRef.current = 0;
    limparTimer();
    procurar();
  }, [procurar]);

  const enviarComando = useCallback((type, payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const pressKey = useCallback((key) => enviarComando("press_key", key), [enviarComando]);
  const holdKeyDown = useCallback((key) => enviarComando("hold_key_down", key), [enviarComando]);
  const holdKeyUp = useCallback((key) => enviarComando("hold_key_up", key), [enviarComando]);

  return {
    estado,
    isConnected: estado === "conectado",
    telemetry,
    servidor,
    progresso,
    pressKey,
    holdKeyDown,
    holdKeyUp,
    conectarManual,
    procurarNovamente,
  };
}
