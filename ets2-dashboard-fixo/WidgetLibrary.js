// Dashlz app/WidgetLibrary.js
//
// O catálogo em si mora em compartilhado/catalogo-widgets.json, na raiz do
// monorepo, porque a janela de espelho do servidor desenha os mesmos widgets e um
// segundo catálogo divergiria. Aqui fica só o que é específico do app: trocar o
// "svg:Nome" do JSON pelo componente de verdade que o transformer do Metro gera.
//
// A forma exportada é a mesma de antes (chave -> { w, h, type, options }), então
// nada mais no app precisa saber que os dados vêm de fora.

import catalogo from "../compartilhado/catalogo-widgets.json";
import { svgs } from "./SvgLibrary";

const PREFIXO_SVG = "svg:";

function resolverIcone(iconName) {
  if (typeof iconName !== "string" || !iconName.startsWith(PREFIXO_SVG)) {
    return iconName; // nome do MaterialCommunityIcons, ou nada
  }
  const nome = iconName.slice(PREFIXO_SVG.length);
  const componente = svgs[nome];
  if (!componente) {
    console.warn(`WidgetLibrary: SVG "${nome}" não existe em SvgLibrary.js`);
    return null;
  }
  return componente;
}

const WIDGETS = {};
for (const [chave, definicao] of Object.entries(catalogo)) {
  WIDGETS[chave] = {
    ...definicao,
    options: {
      ...definicao.options,
      iconName: resolverIcone(definicao.options.iconName),
    },
  };
}

export const WIDGET_LIBRARY = WIDGETS;
