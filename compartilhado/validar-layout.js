// Validação de um layout antes de ele virar tela.
//
// Um layout deixou de ser código nosso: ele é gravado em disco pelo editor, pode
// ser editado à mão, e atravessa a rede do PC para o tablet. Os dois lados validam
// — o servidor ao gravar, o app ao receber — e por isso a regra mora aqui, num
// arquivo só, como o avaliador.
//
// A postura é a mesma do `rehydrateLayout`: item ruim é **descartado**, não derruba
// o painel inteiro. Um widget a menos é recuperável; uma tela preta, no meio de uma
// viagem, não.
//
// CommonJS de propósito: Metro consome por `import`, Electron por `require`.

const { CORES_PADRAO } = require("./cores");

const MAX_ITENS = 400;
const MAX_COORD = 200; // em células
const MAX_TAMANHO = 100;
const MAX_TEXTO = 200;
const MAX_TELA = 200; // colunas/linhas

const CHAVES_OPTIONS = new Set([
  "label", "showLabel", "iconName", "key", "isContinuous",
  "ativoSe", "valor", "cores", "text", "fontSize",
]);

const CHAVES_CORES = new Set(Object.keys(CORES_PADRAO));

// Só hexadecimal e rgb/rgba com números. Cor vai parar dentro de `style`, então é
// o campo mais fácil de virar entrada suja — nada de url(), var() ou javascript:.
const COR_HEX = /^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i;
const COR_RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

function corValida(v) {
  return typeof v === "string" && (COR_HEX.test(v) || COR_RGB.test(v));
}

const inteiroEntre = (v, min, max) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

// Devolve as cores aproveitáveis, ignorando chave desconhecida e cor malformada.
function limparCores(cores, erros, onde) {
  if (cores === undefined) return undefined;
  if (!cores || typeof cores !== "object" || Array.isArray(cores)) {
    erros.push(`${onde}: "cores" não é um objeto`);
    return undefined;
  }
  const limpo = {};
  for (const [nome, valor] of Object.entries(cores)) {
    if (!CHAVES_CORES.has(nome)) {
      erros.push(`${onde}: cor desconhecida "${nome}"`);
      continue;
    }
    if (!corValida(valor)) {
      erros.push(`${onde}: cor inválida em "${nome}"`);
      continue;
    }
    limpo[nome] = valor;
  }
  return Object.keys(limpo).length ? limpo : undefined;
}

function limparOptions(options, erros, onde, teclasPermitidas) {
  if (options === undefined) return undefined;
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    erros.push(`${onde}: "options" não é um objeto`);
    return undefined;
  }

  const limpo = {};
  for (const [chave, valor] of Object.entries(options)) {
    if (!CHAVES_OPTIONS.has(chave)) {
      erros.push(`${onde}: opção desconhecida "${chave}"`);
      continue;
    }
    switch (chave) {
      case "cores": {
        const cores = limparCores(valor, erros, onde);
        if (cores) limpo.cores = cores;
        break;
      }
      case "showLabel":
      case "isContinuous":
        if (typeof valor !== "boolean") erros.push(`${onde}: "${chave}" não é booleano`);
        else limpo[chave] = valor;
        break;
      case "fontSize":
        if (!inteiroEntre(valor, 6, 200)) erros.push(`${onde}: "fontSize" fora de 6..200`);
        else limpo.fontSize = valor;
        break;
      case "key":
        // O servidor confere de novo contra TECLAS_PERMITIDAS antes do robotjs;
        // isto só antecipa o erro, com o nome do widget junto.
        if (typeof valor !== "string") erros.push(`${onde}: "key" não é texto`);
        else if (teclasPermitidas && !teclasPermitidas.has(valor))
          erros.push(`${onde}: tecla "${valor}" fora da allowlist`);
        else limpo.key = valor;
        break;
      case "label":
      case "text":
      case "iconName":
        if (typeof valor !== "string") erros.push(`${onde}: "${chave}" não é texto`);
        else limpo[chave] = valor.slice(0, MAX_TEXTO);
        break;
      default:
        // ativoSe e valor são descritores; o avaliador já ignora o que não entende.
        limpo[chave] = valor;
    }
  }
  return Object.keys(limpo).length ? limpo : undefined;
}

// Área da tela do tablet, em células. Opcional: sem ela vale o comportamento
// antigo do app, que mede os limites do que existe e centraliza o bloco.
function validarTela(tela) {
  if (!tela || typeof tela !== "object" || Array.isArray(tela)) return null;
  if (!inteiroEntre(tela.colunas, 1, MAX_TELA)) return null;
  if (!inteiroEntre(tela.linhas, 1, MAX_TELA)) return null;
  return { colunas: tela.colunas, linhas: tela.linhas };
}

// `catalogo` é o catalogo-widgets.json; sem ele não dá para saber se o widgetKey
// existe, então é obrigatório.
function validarLayout(bruto, catalogo, opcoes = {}) {
  const { teclasPermitidas = null } = opcoes;
  const tela = validarTela(opcoes.tela);
  const erros = [];
  // Widget fora da moldura vira aviso, não descarte: o editor mostra e quem
  // decide é o dono do painel.
  const foraDaTela = [];

  if (!Array.isArray(bruto)) {
    return { ok: false, layout: [], tela, erros: ["o layout não é uma lista"], foraDaTela: [] };
  }
  if (bruto.length > MAX_ITENS) {
    erros.push(`layout com ${bruto.length} itens; usando os primeiros ${MAX_ITENS}`);
  }

  const layout = [];
  const idsVistos = new Set();

  bruto.slice(0, MAX_ITENS).forEach((item, i) => {
    const onde = `item ${i}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      erros.push(`${onde}: não é um objeto`);
      return;
    }
    if (typeof item.widgetKey !== "string" || !catalogo[item.widgetKey]) {
      erros.push(`${onde}: widgetKey "${item.widgetKey}" não existe no catálogo`);
      return;
    }
    if (!inteiroEntre(item.x, 0, MAX_COORD) || !inteiroEntre(item.y, 0, MAX_COORD)) {
      erros.push(`${onde} (${item.widgetKey}): x/y inválidos`);
      return;
    }

    const base = catalogo[item.widgetKey];
    const limpo = { widgetKey: item.widgetKey, x: item.x, y: item.y };

    // w/h são opcionais: sem eles vale o tamanho do catálogo.
    for (const dim of ["w", "h"]) {
      if (item[dim] === undefined) continue;
      if (!inteiroEntre(item[dim], 1, MAX_TAMANHO)) {
        erros.push(`${onde} (${item.widgetKey}): "${dim}" fora de 1..${MAX_TAMANHO}`);
        limpo[dim] = base[dim];
      } else {
        limpo[dim] = item[dim];
      }
    }

    // id só precisa ser único e estável: é a chave de reconciliação da lista.
    let id = typeof item.id === "string" && item.id ? item.id : `${item.widgetKey}-${i}`;
    while (idsVistos.has(id)) id = `${id}-${i}`;
    idsVistos.add(id);
    limpo.id = id;

    const options = limparOptions(item.options, erros, `${onde} (${item.widgetKey})`, teclasPermitidas);
    if (options) limpo.options = options;

    if (tela) {
      const larg = limpo.w ?? base.w;
      const alt = limpo.h ?? base.h;
      if (limpo.x + larg > tela.colunas || limpo.y + alt > tela.linhas) {
        foraDaTela.push(limpo.id);
      }
    }

    layout.push(limpo);
  });

  if (foraDaTela.length) {
    erros.push(
      `${foraDaTela.length} widget(s) fora da tela de ${tela.colunas}x${tela.linhas}: ` +
        foraDaTela.slice(0, 5).join(", ")
    );
  }

  return { ok: layout.length > 0, layout, tela, erros, foraDaTela };
}

module.exports = { validarLayout, validarTela, corValida, MAX_ITENS, MAX_TELA };
