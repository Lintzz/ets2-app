// Gera dashboard/icones.json, os desenhos que a janela de espelho usa.
//
// A janela é HTML puro, então não tem MaterialCommunityIcons nem o transformer de
// SVG do Metro. Em vez de embutir o .ttf inteiro (1,3 MB para 35 ícones) ou de
// depender de CDN, os desenhos são extraídos uma vez para um JSON pequeno:
//
//   - os 35 ícones MaterialCommunityIcons citados pelo catálogo, como path do
//     @mdi/js (devDependency, não vai para o pacote);
//   - os 12 SVGs próprios, lidos de ets2-dashboard-fixo/assets — os mesmos
//     arquivos que o app importa, para não haver dois desenhos do mesmo ícone.
//
// Rode de novo (`npm run gerar:icones`) depois de acrescentar um widget com
// ícone novo, ou de reexportar um SVG. O JSON é versionado, como recursos/PluginETS2.dll.

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const CATALOGO = path.join(RAIZ, "compartilhado", "catalogo-widgets.json");
const ASSETS = path.join(RAIZ, "ets2-dashboard-fixo", "assets");
const SAIDA = path.join(__dirname, "..", "dashboard", "icones.json");

let mdi;
try {
  mdi = require("@mdi/js");
} catch {
  console.error("Falta o @mdi/js. Rode: npm install --save-dev @mdi/js");
  process.exit(1);
}

const paraCamel = (nome) =>
  "mdi" + nome.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");

const catalogo = JSON.parse(fs.readFileSync(CATALOGO, "utf8"));

const nomesMdi = new Set();
const nomesSvg = new Set();
for (const def of Object.values(catalogo)) {
  const icone = def.options && def.options.iconName;
  if (typeof icone !== "string") continue;
  if (icone.startsWith("svg:")) nomesSvg.add(icone.slice(4));
  else nomesMdi.add(icone);
}

const saida = { mdi: {}, svg: {} };

for (const nome of [...nomesMdi].sort()) {
  const d = mdi[paraCamel(nome)];
  if (!d) {
    console.error(`Ícone "${nome}" não existe no @mdi/js.`);
    process.exit(1);
  }
  saida.mdi[nome] = d;
}

for (const nome of [...nomesSvg].sort()) {
  const arquivo = path.join(ASSETS, `${nome}.svg`);
  if (!fs.existsSync(arquivo)) {
    console.error(`SVG não encontrado: ${arquivo}`);
    process.exit(1);
  }
  const texto = fs.readFileSync(arquivo, "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(texto);
  const corpo = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(texto);
  if (!viewBox || !corpo) {
    console.error(`SVG em formato inesperado: ${arquivo}`);
    process.exit(1);
  }
  // Os arquivos não trazem fill próprio, então o desenho herda a cor de quem o
  // insere — é assim que o app recolore o ícone quando o botão acende.
  saida.svg[nome] = {
    viewBox: viewBox[1],
    corpo: corpo[1].replace(/\s+/g, " ").trim(),
  };
}

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + "\n");

console.log(
  `dashboard/icones.json: ${Object.keys(saida.mdi).length} MaterialCommunityIcons + ` +
    `${Object.keys(saida.svg).length} SVGs próprios`
);
