// Dashlz app/hooks/useTelemetry.js

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { identificar, varrerSubRede } from "./descoberta";
import {
  BACKOFF_MS,
  CHAVE_DEVICE_ID,
  CHAVE_SEGREDO,
  CHAVE_ULTIMO_IP,
  CODIGO_DIGITOS,
  montarProva,
  PROTOCOLO_VERSAO,
  RECUSA,
  TCP_PORT,
  TIMEOUT_IP_CONHECIDO_MS,
} from "./protocolo";

// Estados possíveis: "iniciando" | "procurando" | "conectando" | "conectado"
//                    | "precisa-codigo" | "recusado" | "sem-servidor"
//                    | "app-desatualizado"
const nomeDoAparelho = () => {
  const modelo = Platform.constants?.Model || Platform.constants?.Brand;
  return modelo ? String(modelo) : `Dashboard ${Platform.OS}`;
};

async function obterDeviceId() {
  let id = await AsyncStorage.getItem(CHAVE_DEVICE_ID);
  if (!id) {
    // Identidade estável deste aparelho. Sozinha ela não autoriza nada: quem
    // autoriza é o segredo entregue no pareamento.
    id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(CHAVE_DEVICE_ID, id);
  }
  return id;
}

// Segredo do pareamento com este servidor. Guardado só aqui; nunca é mandado
// pela rede depois do pareamento — o que viaja é o SHA-256 de nonce:segredo.
const lerSegredo = () => AsyncStorage.getItem(CHAVE_SEGREDO);
const guardarSegredo = (s) => AsyncStorage.setItem(CHAVE_SEGREDO, s);
const apagarSegredo = () => AsyncStorage.removeItem(CHAVE_SEGREDO);

async function calcularProva(nonce, segredo) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    montarProva(nonce, segredo)
  );
}

export function useTelemetry() {
  const [estado, setEstado] = useState("iniciando");
  const [telemetry, setTelemetry] = useState(null);
  const [servidor, setServidor] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [erroPareamento, setErroPareamento] = useState(null);

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
  const codigoRef = useRef(null); // código digitado, gasto no próximo hello

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

    // O servidor fala primeiro, mandando um nonce. Só então dá para montar o
    // hello: com a prova (se já pareado) ou com o código que o usuário digitou.
    ws.onopen = () => {};

    ws.onmessage = async (evento) => {
      let dados;
      try {
        dados = JSON.parse(evento.data);
      } catch {
        return;
      }

      // Handshake
      if (dados && dados.type === "challenge") {
        const hello = {
          type: "hello",
          protocolo: PROTOCOLO_VERSAO,
          deviceId: deviceIdRef.current,
          nome: nomeDoAparelho(),
        };

        const segredo = await lerSegredo();

        if (segredo) {
          hello.prova = await calcularProva(dados.nonce, segredo);
        } else if (codigoRef.current) {
          hello.codigo = codigoRef.current;
          codigoRef.current = null; // uso único, como no servidor
        } else if (!dados.pareado) {
          // Servidor sem dono e nós sem código: parar aqui e pedir ao usuário.
          mudarEstado("precisa-codigo");
          return;
        }

        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(hello));
        }
        return;
      }

      if (dados && dados.type === "welcome") {
        // O segredo vem uma única vez, no pareamento.
        if (dados.segredo) {
          try {
            await guardarSegredo(dados.segredo);
          } catch {
            /* sem storage: pareia de novo na próxima abertura */
          }
        }
        tentativaRef.current = 0;
        setErroPareamento(null);
        mudarEstado("conectado");
        AsyncStorage.setItem(CHAVE_ULTIMO_IP, JSON.stringify(alvo)).catch(() => {});
        return;
      }

      if (dados && dados.type === "denied") {
        // O segredo guardado não vale mais (o PC esqueceu o aparelho, ou outro
        // aparelho assumiu): jogar fora e voltar a pedir o código.
        if (
          dados.reason === RECUSA.PROVA_INVALIDA ||
          dados.reason === RECUSA.PRECISA_CODIGO
        ) {
          try {
            await apagarSegredo();
          } catch {
            /* ignora */
          }
        }

        setErroPareamento(dados.reason || "recusado");
        mudarEstado(
          dados.reason === RECUSA.PROTOCOLO
            ? "app-desatualizado"
            : dados.reason === RECUSA.JA_PAREADO
              ? "recusado"
              : "precisa-codigo"
        );
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

      // Estes três dependem de uma ação do usuário — reconectar em laço não
      // adianta: liberar o pareamento no PC, digitar o código, ou atualizar
      // o aplicativo.
      if (
        estadoRef.current === "recusado" ||
        estadoRef.current === "precisa-codigo" ||
        estadoRef.current === "app-desatualizado"
      ) {
        return;
      }
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

  // Envia o código que o usuário leu na janela do servidor. Guarda em ref e
  // reabre a conexão: o código é gasto na resposta ao próximo challenge.
  const parearComCodigo = useCallback(
    (codigo) => {
      const limpo = String(codigo || "").replace(/\D/g, "");
      if (limpo.length !== CODIGO_DIGITOS) return false;

      codigoRef.current = limpo;
      setErroPareamento(null);
      tentativaRef.current = 0;
      limparTimer();

      // servidor já é conhecido quando chegamos em "precisa-codigo"
      if (servidor) conectar(servidor);
      else procurar();

      return true;
    },
    [conectar, procurar, servidor]
  );

  // Desfaz o pareamento deste lado (o do PC sai em "Esquecer aparelho").
  const esquecerPareamento = useCallback(async () => {
    try {
      await apagarSegredo();
    } catch {
      /* ignora */
    }
    setErroPareamento(null);
    procurarNovamente();
  }, [procurarNovamente]);

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
    erroPareamento,
    pressKey,
    holdKeyDown,
    holdKeyUp,
    conectarManual,
    procurarNovamente,
    parearComCodigo,
    esquecerPareamento,
  };
}
