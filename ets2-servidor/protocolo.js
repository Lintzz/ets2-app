// ETS2_Servidor/protocolo.js
// Constantes compartilhadas entre o servidor e o app. Se algo aqui mudar, o
// mesmo valor precisa mudar em ets2-dashboard-fixo/hooks/protocolo.js.

// 3: pareamento por código + desafio-resposta. A versão 2 aceitava o primeiro
// aparelho que aparecesse na rede, sem nenhum segredo — um app antigo contra um
// servidor novo é recusado de propósito.
const PROTOCOLO_VERSAO = 3;

// Precisa bater com TELEMETRIA_SCHEMA_VERSION em leitor_memoria.cpp e main.cpp.
const SCHEMA_ESPERADO = 2;

const DISCOVERY_PORT = 48888;
const TCP_PORT = 3000;

// Tipos de mensagem UDP (descoberta)
const UDP_PROBE = "ets2-probe"; // app  -> rede (broadcast)
const UDP_ANNOUNCE = "ets2-server"; // servidor -> app (unicast ou broadcast)

// --- Pareamento --------------------------------------------------------------

const CODIGO_DIGITOS = 6;
const CODIGO_VALIDADE_MS = 10 * 60 * 1000; // 10 min
const NONCE_BYTES = 16;
const SEGREDO_BYTES = 32;

// A prova que o app manda a cada conexão. SHA-256 do nonce seguido do segredo:
// o segredo em si nunca mais trafega depois do pareamento, e como ele vem no
// FIM da mensagem, a construção não é vulnerável a extensão de comprimento (que
// é o problema de H(segredo || mensagem)). Os dois lados calculam isto igual.
const montarProva = (nonce, segredo) => `${nonce}:${segredo}`;

// Motivos de recusa mandados ao app.
const RECUSA = {
  PRECISA_CODIGO: "precisa-codigo", // nenhum aparelho pareado: digite o código
  CODIGO_INVALIDO: "codigo-invalido", // código errado ou expirado
  JA_PAREADO: "ja-pareado", // outro aparelho é o dono
  PROVA_INVALIDA: "prova-invalida", // segredo não confere
  PROTOCOLO: "protocolo-incompativel", // app velho demais
};

// Teclas que o servidor aceita digitar. Derivada de WidgetLibrary.js do app:
// qualquer coisa fora desta lista é recusada, então um cliente na rede não
// consegue usar o robotjs para digitar texto arbitrário no PC.
const TECLAS_PERMITIDAS = new Set([
  // letras usadas pelos widgets
  "a", "b", "c", "e", "f", "g", "i", "k", "l", "m", "o", "p", "q", "s", "t", "u", "v", "w",
  // números
  "1", "2", "3",
  // teclado numérico
  "numpad_0", "numpad_1", "numpad_2", "numpad_3", "numpad_4",
  // função
  "f2", "f3", "f4", "f5", "f6", "f7", "f10",
  // navegação / controle
  "up", "down", "left", "right", "home", "end", "insert", "delete",
  "enter", "escape", "space", "command",
  // pontuação
  "'", ";",
]);

module.exports = {
  PROTOCOLO_VERSAO,
  SCHEMA_ESPERADO,
  DISCOVERY_PORT,
  TCP_PORT,
  UDP_PROBE,
  UDP_ANNOUNCE,
  CODIGO_DIGITOS,
  CODIGO_VALIDADE_MS,
  NONCE_BYTES,
  SEGREDO_BYTES,
  montarProva,
  RECUSA,
  TECLAS_PERMITIDAS,
};
