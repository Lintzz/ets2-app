// ETS2_Servidor/protocolo.js
// Constantes compartilhadas entre o servidor e o app. Se algo aqui mudar, o
// mesmo valor precisa mudar em ets2-dashboard-fixo/hooks/protocolo.js.

const PROTOCOLO_VERSAO = 2;

// Precisa bater com TELEMETRIA_SCHEMA_VERSION em leitor_memoria.cpp e main.cpp.
const SCHEMA_ESPERADO = 2;

const DISCOVERY_PORT = 48888;
const TCP_PORT = 3000;

// Tipos de mensagem UDP (descoberta)
const UDP_PROBE = "ets2-probe"; // app  -> rede (broadcast)
const UDP_ANNOUNCE = "ets2-server"; // servidor -> app (unicast ou broadcast)

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
  TECLAS_PERMITIDAS,
};
