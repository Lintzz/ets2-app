// Dashlz servidor/testes/layout.js
// Exercita o validador de layout e a paleta compartilhada.
//
// Um layout deixou de ser código nosso: é gravado em disco, pode ser editado à mão
// e atravessa a rede até o tablet. Este arquivo é a rede de proteção disso — em
// especial das cores, que vão parar dentro de `style` nos dois renderizadores.
//
//   npm test
//
// Sai com código 1 se qualquer caso falhar.

const path = require("path");

const compartilhado = (nome) => require(path.join(__dirname, "..", "..", "compartilhado", nome));

const { validarLayout, validarTela, corValida, MAX_ITENS } = compartilhado("validar-layout");
const { CORES_PADRAO, resolverCores } = compartilhado("cores");
const catalogo = compartilhado("catalogo-widgets.json");
const layoutPadrao = compartilhado("layout-padrao.json");

const resultados = [];
function verificar(nome, condicao, detalhe) {
  resultados.push({ nome, ok: !!condicao });
  console.log(
    `${condicao ? "  ok  " : " FALHA"}  ${nome}${condicao || !detalhe ? "" : ` — ${detalhe}`}`
  );
}
const igual = (nome, obtido, esperado) =>
  verificar(
    nome,
    obtido === esperado,
    `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`
  );

// Base válida, para cada caso mexer num campo só.
const bom = () => [{ id: "a", widgetKey: "speed-display", x: 1, y: 2, w: 3, h: 2 }];
const validar = (bruto, opcoes) => validarLayout(bruto, catalogo, opcoes);

console.log("\nCores\n");

igual("hex de 6 dígitos", corValida("#00FF7F"), true);
igual("hex de 3 dígitos", corValida("#0f7"), true);
igual("hex com alfa", corValida("#00FF7F80"), true);
igual("rgba", corValida("rgba(30, 32, 39, 0.8)"), true);
igual("rgb", corValida("rgb(30,32,39)"), true);
igual("nome de cor não passa", corValida("red"), false);
igual("url() não passa", corValida("url(http://x/y.png)"), false);
igual("var() não passa", corValida("var(--x)"), false);
igual("javascript: não passa", corValida("javascript:alert(1)"), false);
igual("expressão com ; não passa", corValida("#fff; background: url(x)"), false);
igual("não-texto não passa", corValida(123), false);

igual("resolverCores sem nada devolve o padrão", resolverCores().iconeAtiva, CORES_PADRAO.iconeAtiva);
igual("resolverCores é parcial", resolverCores({ icone: "#000" }).iconeAtiva, CORES_PADRAO.iconeAtiva);
igual("resolverCores sobrescreve", resolverCores({ icone: "#000" }).icone, "#000");
verificar(
  "toda cor padrão é uma cor válida",
  Object.values(CORES_PADRAO).every(corValida),
  Object.entries(CORES_PADRAO).filter(([, v]) => !corValida(v)).map(([k]) => k).join(", ")
);

console.log("\nValidação de layout\n");

let r = validar(layoutPadrao);
igual("o layout de fábrica passa inteiro", r.layout.length, layoutPadrao.length);
verificar("o layout de fábrica não gera erro", r.erros.length === 0, r.erros.slice(0, 3).join("; "));

igual("item bom sobrevive", validar(bom()).layout.length, 1);
igual("não-lista é recusado", validar({ nao: "lista" }).ok, false);
igual("lista vazia não é ok", validar([]).ok, false);
igual("item que não é objeto some", validar(["oi", 42, null]).layout.length, 0);

const semChave = bom();
semChave[0].widgetKey = "nao-existe";
igual("widgetKey fora do catálogo some", validar(semChave).layout.length, 0);

for (const ruim of ["abc", 1.5, -1, 9999, null, undefined]) {
  const l = bom();
  l[0].x = ruim;
  igual(`x = ${JSON.stringify(ruim)} descarta o item`, validar(l).layout.length, 0);
}

// w/h ruins não matam o item: ele volta ao tamanho do catálogo.
const tamanhoRuim = bom();
tamanhoRuim[0].w = 0;
r = validar(tamanhoRuim);
igual("w inválido cai no tamanho do catálogo", r.layout[0] && r.layout[0].w, catalogo["speed-display"].w);
verificar("w inválido é relatado", r.erros.length > 0);

const semTamanho = [{ id: "a", widgetKey: "speed-display", x: 1, y: 2 }];
igual("w/h ausentes são aceitos", validar(semTamanho).layout.length, 1);
igual("w/h ausentes não são inventados", validar(semTamanho).layout[0].w, undefined);

console.log("\nOptions\n");

const comCorRuim = bom();
comCorRuim[0].options = { cores: { icone: "url(x)", iconeAtiva: "#00FF7F" } };
r = validar(comCorRuim);
igual("cor inválida é removida", r.layout[0].options.cores.icone, undefined);
igual("cor válida ao lado sobrevive", r.layout[0].options.cores.iconeAtiva, "#00FF7F");

const corDesconhecida = bom();
corDesconhecida[0].options = { cores: { naoExiste: "#fff" } };
r = validar(corDesconhecida);
igual("chave de cor desconhecida some", r.layout[0].options, undefined);
verificar("chave de cor desconhecida é relatada", r.erros.some((e) => e.includes("naoExiste")));

const opcaoDesconhecida = bom();
opcaoDesconhecida[0].options = { onClick: "alert(1)", label: "Velocidade" };
r = validar(opcaoDesconhecida);
igual("opção desconhecida some", r.layout[0].options.onClick, undefined);
igual("opção conhecida ao lado sobrevive", r.layout[0].options.label, "Velocidade");

const tipoErrado = bom();
tipoErrado[0].options = { showLabel: "sim", fontSize: 5 };
r = validar(tipoErrado);
igual("showLabel não-booleano some", r.layout[0].options, undefined);
verificar("fontSize fora da faixa é relatado", r.erros.some((e) => e.includes("fontSize")));

const comTecla = bom();
comTecla[0].options = { key: "f10" };
igual(
  "tecla na allowlist passa",
  validar(comTecla, { teclasPermitidas: new Set(["f10"]) }).layout[0].options.key,
  "f10"
);
comTecla[0].options = { key: "windows" };
r = validar(comTecla, { teclasPermitidas: new Set(["f10"]) });
igual("tecla fora da allowlist some", r.layout[0].options, undefined);
verificar("tecla fora da allowlist é relatada", r.erros.some((e) => e.includes("allowlist")));

console.log("\nMoldura da tela\n");

igual("tela boa passa", JSON.stringify(validarTela({ colunas: 36, linhas: 23 })),
  JSON.stringify({ colunas: 36, linhas: 23 }));
igual("tela ausente e nula", validarTela(undefined), null);
igual("coluna zero e recusada", validarTela({ colunas: 0, linhas: 23 }), null);
igual("linha negativa e recusada", validarTela({ colunas: 36, linhas: -1 }), null);
igual("valor nao inteiro e recusado", validarTela({ colunas: 36.5, linhas: 23 }), null);
igual("texto e recusado", validarTela({ colunas: "36", linhas: "23" }), null);
igual("array e recusado", validarTela([36, 23]), null);
igual("acima do maximo e recusado", validarTela({ colunas: 500, linhas: 23 }), null);

// Fora da moldura e aviso, nao descarte: o painel do usuario nao pode perder um
// widget so porque ele encostou na borda.
const foraDaBorda = [{ id: "f", widgetKey: "speed-display", x: 34, y: 1, w: 3, h: 2 }];
r = validar(foraDaBorda, { tela: { colunas: 36, linhas: 23 } });
igual("widget fora da moldura sobrevive", r.layout.length, 1);
igual("e e listado", r.foraDaTela.length, 1);
verificar("e o aviso diz onde", r.erros.some((e) => e.includes("fora da tela")));

r = validar(foraDaBorda, { tela: { colunas: 40, linhas: 23 } });
igual("dentro da moldura nao avisa", r.foraDaTela.length, 0);

r = validar(foraDaBorda);
igual("sem moldura nao ha o que avisar", r.foraDaTela.length, 0);
igual("sem moldura a tela volta nula", r.tela, null);

// w/h ausentes: a moldura e conferida com o tamanho do catalogo.
const semTamanhoNaBorda = [{ id: "g", widgetKey: "speed-display", x: 34, y: 1 }];
igual("moldura usa o tamanho do catalogo quando falta w/h",
  validar(semTamanhoNaBorda, { tela: { colunas: 36, linhas: 23 } }).foraDaTela.length, 1);

console.log("\nLimites e ids\n");

const gigante = Array.from({ length: MAX_ITENS + 50 }, (_, i) => ({
  id: `w${i}`, widgetKey: "speed-display", x: 1, y: 1,
}));
r = validar(gigante);
igual("layout gigante é truncado", r.layout.length, MAX_ITENS);
verificar("truncamento é relatado", r.erros.some((e) => e.includes("itens")));

const idsRepetidos = [
  { id: "x", widgetKey: "speed-display", x: 1, y: 1 },
  { id: "x", widgetKey: "speed-display", x: 2, y: 1 },
];
r = validar(idsRepetidos);
igual("os dois itens sobrevivem", r.layout.length, 2);
verificar("ids repetidos são desempatados", r.layout[0].id !== r.layout[1].id);

const semId = [{ widgetKey: "speed-display", x: 1, y: 1 }];
verificar("id ausente é gerado", typeof validar(semId).layout[0].id === "string");

const falhas = resultados.filter((r2) => !r2.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} casos passaram.\n`);
process.exit(falhas.length > 0 ? 1 : 0);
