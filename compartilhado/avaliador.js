// Interpretador dos descritores declarativos do catálogo de widgets.
//
// Antes, cada widget carregava funções JS vivas (`isActiveCheck`, `value`) dentro
// de WidgetLibrary.js. Funções não viram JSON, então o catálogo não podia sair do
// app — nem para a janela de espelho do servidor, nem para um layout salvo em
// disco. Aqui elas viram dado: `ativoSe` e `valor` são objetos, e este módulo é a
// única coisa que sabe lê-los. App e servidor usam o mesmo arquivo, para não haver
// duas interpretações do mesmo catálogo.
//
// CommonJS de propósito: o Metro consome isto por `import`, o Electron por
// `require`, e não há build step entre os dois.

// `t.campo ?? 0` — é o que o código do app fazia antes de qualquer conta.
function lerCampo(telemetria, campo) {
  if (!telemetria || typeof telemetria !== "object") return 0;
  return telemetria[campo] ?? 0;
}

const COMPARADORES = {
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
};

// Estado aceso/apagado de um botão ou alerta. Sem descritor o widget nunca acende,
// que é como os widgets decorativos se comportavam.
function avaliarAtivo(descritor, telemetria) {
  if (!descritor) return false;

  if (Array.isArray(descritor.qualquer)) {
    return descritor.qualquer.some((sub) => avaliarAtivo(sub, telemetria));
  }
  if (Array.isArray(descritor.todos)) {
    return descritor.todos.every((sub) => avaliarAtivo(sub, telemetria));
  }
  if (!descritor.campo) return false;

  const valor = lerCampo(telemetria, descritor.campo);

  if (descritor.op) {
    const comparar = COMPARADORES[descritor.op];
    if (!comparar) return false;
    return comparar(valor, descritor.valor);
  }
  return Boolean(valor);
}

const FORMATOS = {
  // Marcha: 0 é neutro, negativo é ré. Copiado de "gear-display".
  marcha: (g) => (g === 0 ? "N" : g < 0 ? `R${Math.abs(g)}` : `${g}`),
};

// Texto de um DataDisplay. Sem descritor (ou com o jogo no menu, que quem chama
// resolve antes) o mostrador fica em "--" em vez de exibir zero.
function formatarValor(descritor, telemetria) {
  if (!descritor || !descritor.campo) return "--";

  let valor = lerCampo(telemetria, descritor.campo);

  if (descritor.formato) {
    const formatar = FORMATOS[descritor.formato];
    return formatar ? formatar(valor) : String(valor);
  }

  if (typeof descritor.escala === "number") valor = valor * descritor.escala;
  if (typeof descritor.divisor === "number") valor = valor / descritor.divisor;

  const texto =
    typeof descritor.casas === "number" ? valor.toFixed(descritor.casas) : valor;

  return descritor.sufixo ? `${texto}${descritor.sufixo}` : texto;
}

module.exports = { avaliarAtivo, formatarValor };
