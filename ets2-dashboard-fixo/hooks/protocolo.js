// ETS2_DashboardFixo/hooks/protocolo.js
// Espelha ets2-servidor/protocolo.js. Se mudar um lado, mude o outro.

// 3: pareamento por código + desafio-resposta. Contra um servidor da versão 2
// (ou vice-versa) a conexão é recusada de propósito — a 2 aceitava o primeiro
// aparelho que aparecesse na rede, sem nenhum segredo.
export const PROTOCOLO_VERSAO = 3;

export const TCP_PORT = 3000;

// Endpoint HTTP que identifica o servidor durante a varredura da sub-rede.
export const ROTA_IDENTIFICACAO = "/ets2";
export const ASSINATURA_SERVIDOR = "ets2-server";

// A prova mandada a cada conexão: SHA-256 desta string. O segredo vem no fim de
// propósito (ver o comentário do mesmo trecho no servidor).
export const montarProva = (nonce, segredo) => `${nonce}:${segredo}`;

export const CODIGO_DIGITOS = 6;

// Motivos de recusa que o servidor manda em { type: "denied", reason }.
export const RECUSA = {
  PRECISA_CODIGO: "precisa-codigo",
  CODIGO_INVALIDO: "codigo-invalido",
  JA_PAREADO: "ja-pareado",
  PROVA_INVALIDA: "prova-invalida",
  PROTOCOLO: "protocolo-incompativel",
};

// Chaves do AsyncStorage
export const CHAVE_DEVICE_ID = "ets2:deviceId";
export const CHAVE_ULTIMO_IP = "ets2:ultimoServidor";
export const CHAVE_SEGREDO = "ets2:segredoPareamento";

// Tempos
export const TIMEOUT_IDENTIFICACAO_MS = 800; // por IP durante a varredura
export const TIMEOUT_IP_CONHECIDO_MS = 1500; // ao testar o último servidor usado
export const CONCORRENCIA_VARREDURA = 24;
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
