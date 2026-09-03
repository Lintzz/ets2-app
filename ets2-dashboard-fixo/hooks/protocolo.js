// ETS2_DashboardFixo/hooks/protocolo.js
// Espelha ets2-servidor/protocolo.js. Se mudar um lado, mude o outro.

export const PROTOCOLO_VERSAO = 2;

export const TCP_PORT = 3000;

// Endpoint HTTP que identifica o servidor durante a varredura da sub-rede.
export const ROTA_IDENTIFICACAO = "/ets2";
export const ASSINATURA_SERVIDOR = "ets2-server";

// Chaves do AsyncStorage
export const CHAVE_DEVICE_ID = "ets2:deviceId";
export const CHAVE_ULTIMO_IP = "ets2:ultimoServidor";

// Tempos
export const TIMEOUT_IDENTIFICACAO_MS = 800; // por IP durante a varredura
export const TIMEOUT_IP_CONHECIDO_MS = 1500; // ao testar o último servidor usado
export const CONCORRENCIA_VARREDURA = 24;
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
