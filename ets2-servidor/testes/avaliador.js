// Dashlz servidor/testes/avaliador.js
// Exercita o interpretador dos descritores do catálogo compartilhado, que é o
// que substituiu as funções `isActiveCheck` / `value` de WidgetLibrary.js. O
// catálogo agora atravessa para cá e para o app, então uma regressão aqui apaga
// um widget nos dois lugares ao mesmo tempo.
//
//   npm test
//
// Sai com código 1 se qualquer caso falhar.

const path = require("path");
const { avaliarAtivo, formatarValor } = require(
  path.join(__dirname, "..", "..", "compartilhado", "avaliador")
);
const catalogo = require(
  path.join(__dirname, "..", "..", "compartilhado", "catalogo-widgets.json")
);
const layout = require(
  path.join(__dirname, "..", "..", "compartilhado", "layout-padrao.json")
);
const icones = require(path.join(__dirname, "..", "dashboard", "icones.json"));

const resultados = [];
function verificar(nome, condicao, detalhe) {
  resultados.push({ nome, ok: !!condicao });
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${nome}${condicao || !detalhe ? "" : ` — ${detalhe}`}`);
}
const igual = (nome, obtido, esperado) =>
  verificar(nome, obtido === esperado, `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);

console.log("\nDescritores ativoSe\n");

igual("campo truthy aceso", avaliarAtivo({ campo: "a" }, { a: true }), true);
igual("campo truthy apagado", avaliarAtivo({ campo: "a" }, { a: false }), false);
igual("campo ausente é apagado", avaliarAtivo({ campo: "a" }, {}), false);
igual("zero é apagado", avaliarAtivo({ campo: "a" }, { a: 0 }), false);
igual("sem descritor é apagado", avaliarAtivo(undefined, { a: true }), false);
igual("telemetria nula não explode", avaliarAtivo({ campo: "a" }, null), false);

igual("op > acima", avaliarAtivo({ campo: "v", op: ">", valor: 0 }, { v: 30 }), true);
igual("op > no limite", avaliarAtivo({ campo: "v", op: ">", valor: 0 }, { v: 0 }), false);
igual("op >= no limite", avaliarAtivo({ campo: "v", op: ">=", valor: 0 }, { v: 0 }), true);
igual("op < abaixo", avaliarAtivo({ campo: "v", op: "<", valor: 0 }, { v: -1 }), true);
igual("op <= no limite", avaliarAtivo({ campo: "v", op: "<=", valor: 5 }, { v: 5 }), true);
igual("op == confere", avaliarAtivo({ campo: "v", op: "==", valor: 3 }, { v: 3 }), true);
igual("op != confere", avaliarAtivo({ campo: "v", op: "!=", valor: 3 }, { v: 3 }), false);
igual("op desconhecido é apagado", avaliarAtivo({ campo: "v", op: "~", valor: 1 }, { v: 1 }), false);
igual("campo ausente vira 0 na comparação", avaliarAtivo({ campo: "v", op: ">", valor: 0 }, {}), false);

const luzes = { qualquer: [{ campo: "a" }, { campo: "b" }, { campo: "c" }] };
igual("qualquer com um aceso", avaliarAtivo(luzes, { a: false, b: true, c: false }), true);
igual("qualquer com nenhum aceso", avaliarAtivo(luzes, { a: false, b: false, c: false }), false);
const ambos = { todos: [{ campo: "a" }, { campo: "b" }] };
igual("todos com os dois acesos", avaliarAtivo(ambos, { a: true, b: true }), true);
igual("todos com um apagado", avaliarAtivo(ambos, { a: true, b: false }), false);

console.log("\nDescritores valor\n");

igual("casas arredonda", formatarValor({ campo: "v", casas: 0 }, { v: 82.6 }), "83");
igual("divisor e sufixo", formatarValor({ campo: "v", divisor: 1000, casas: 1, sufixo: " km" }, { v: 12345 }), "12.3 km");
igual("escala e sufixo", formatarValor({ campo: "v", escala: 100, casas: 0, sufixo: "%" }, { v: 0.37 }), "37%");
igual("sem casas devolve cru", formatarValor({ campo: "v" }, { v: 3 }), 3);
igual("campo ausente vira 0", formatarValor({ campo: "v", casas: 0 }, {}), "0");
igual("sem descritor mostra --", formatarValor(undefined, { v: 1 }), "--");
igual("telemetria nula mostra 0", formatarValor({ campo: "v", casas: 0 }, null), "0");

igual("marcha neutra", formatarValor({ campo: "marcha", formato: "marcha" }, { marcha: 0 }), "N");
igual("marcha à frente", formatarValor({ campo: "marcha", formato: "marcha" }, { marcha: 7 }), "7");
igual("marcha a ré", formatarValor({ campo: "marcha", formato: "marcha" }, { marcha: -2 }), "R2");
igual("marcha ausente é neutra", formatarValor({ campo: "marcha", formato: "marcha" }, {}), "N");
igual("formato desconhecido não explode", formatarValor({ campo: "v", formato: "?" }, { v: 9 }), "9");

console.log("\nIntegridade do catálogo\n");

const TIPOS_CONHECIDOS = new Set([
  "ColorArea", "TextWidget", "CircularButton", "IconButton",
  "DataDisplay", "FuelGauge", "Alert",
]);

const chaves = Object.keys(catalogo);
verificar("catálogo não está vazio", chaves.length > 0);

const tiposEstranhos = chaves.filter((k) => !TIPOS_CONHECIDOS.has(catalogo[k].type));
verificar("todo widget tem um type conhecido", tiposEstranhos.length === 0, tiposEstranhos.join(", "));

const semTamanho = chaves.filter((k) => !(catalogo[k].w > 0 && catalogo[k].h > 0));
verificar("todo widget tem w e h", semTamanho.length === 0, semTamanho.join(", "));

// Um DataDisplay sem `valor` fica preso em "--" — é o erro mais fácil de cometer
// ao converter um widget novo.
const displaysMudos = chaves.filter(
  (k) => catalogo[k].type === "DataDisplay" && !catalogo[k].options.valor
);
verificar("todo DataDisplay tem descritor valor", displaysMudos.length === 0, displaysMudos.join(", "));

// Resquício da forma antiga: se alguém copiar uma entrada de um commit velho, a
// função volta em silêncio e o widget passa a nunca acender.
const comFuncao = chaves.filter(
  (k) => catalogo[k].options.isActiveCheck !== undefined || catalogo[k].options.value !== undefined
);
verificar("nenhum resquício de isActiveCheck/value", comFuncao.length === 0, comFuncao.join(", "));

// Mesma armadilha para as cores: `color` e `activeColor` viraram `cores.*`, e uma
// entrada copiada de um commit velho voltaria a ser ignorada em silêncio.
const corAntiga = chaves.filter(
  (k) => catalogo[k].options.color !== undefined || catalogo[k].options.activeColor !== undefined
);
verificar("nenhum resquício de color/activeColor", corAntiga.length === 0, corAntiga.join(", "));

const OPS = new Set([">", ">=", "<", "<=", "==", "!="]);
const descritoresRuins = [];
for (const k of chaves) {
  const percorrer = (d) => {
    if (!d) return;
    if (Array.isArray(d.qualquer)) return d.qualquer.forEach(percorrer);
    if (Array.isArray(d.todos)) return d.todos.forEach(percorrer);
    if (!d.campo) descritoresRuins.push(`${k}: sem campo`);
    else if (d.op && !OPS.has(d.op)) descritoresRuins.push(`${k}: op "${d.op}"`);
  };
  percorrer(catalogo[k].options.ativoSe);
}
verificar("todo ativoSe é bem formado", descritoresRuins.length === 0, descritoresRuins.join("; "));

const semIcone = [];
for (const k of chaves) {
  const icone = catalogo[k].options.iconName;
  if (typeof icone !== "string") continue;
  const achou = icone.startsWith("svg:")
    ? !!icones.svg[icone.slice(4)]
    : !!icones.mdi[icone];
  if (!achou) semIcone.push(`${k}: ${icone}`);
}
verificar("todo ícone do catálogo existe em dashboard/icones.json", semIcone.length === 0, semIcone.join("; "));

const layoutOrfao = [...new Set(layout.map((w) => w.widgetKey).filter((k) => !catalogo[k]))];
verificar("layout padrão só cita widgets do catálogo", layoutOrfao.length === 0, layoutOrfao.join(", "));

const semPosicao = layout.filter(
  (w) => !Number.isFinite(w.x) || !Number.isFinite(w.y) || !w.widgetKey
);
verificar("todo item do layout tem widgetKey, x e y", semPosicao.length === 0);

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} casos passaram.\n`);
process.exit(falhas.length > 0 ? 1 : 0);
