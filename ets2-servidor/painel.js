// Dashlz servidor/painel.js
// Serve a janela do painel (dashboard.html): o espelho e o editor.
//
// Isto roda no processo principal, e não no preload, porque o preload do Electron
// é sandboxed: lá o `require` só entrega electron/events/timers/url, e carregar o
// catálogo de compartilhado/ falha com "module not found: path". Manter a leitura
// aqui também evita afrouxar o sandbox de uma janela só para ler dois JSON.
//
// A janela recebe duas coisas bem diferentes:
//
//   painelParaJanela()  o catálogo resolvido e o layout **cru** — é o cru que o
//                       editor devolve ao salvar, então ele não pode chegar lá já
//                       mesclado. O merge acontece no renderer, por widget.
//
//   avaliarPainel()     por quadro, só o estado de cada widget (aceso/apagado e o
//                       texto). O interpretador dos descritores continua existindo
//                       num arquivo só, em compartilhado/avaliador.js, e o renderer
//                       não conhece o contrato — não tem como divergir do app.

const path = require("path");
const { app } = require("electron");

// Empacotada, a pasta vai como extraResource e cai em resources/compartilhado;
// em desenvolvimento fica um nível acima. Mesmo desvio de recursos/PluginETS2.dll.
function pastaCompartilhada() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "compartilhado")
    : path.join(__dirname, "..", "compartilhado");
}

const carregar = (nome) => require(path.join(pastaCompartilhada(), nome));

let montado = null;
// Layout ativo. null = ainda ninguém escolheu, então vale o de fábrica.
let layoutAtual = null;
let telaAtual = null;

// Chamado pelo main.js a cada troca de preset e a cada gravação. Zera a
// memoização: sem isto a janela continuaria desenhando o layout anterior.
function definirLayout(widgets, tela) {
  layoutAtual = Array.isArray(widgets) ? widgets : null;
  telaAtual = tela || null;
  montado = null;
}

function montarPainel() {
  if (montado) return montado;

  const catalogoBruto = carregar("catalogo-widgets.json");
  const { TAMANHO_CELULA } = carregar("constantes");
  const { resolverCores } = carregar("cores");
  const icones = require("./dashboard/icones.json");

  // Catálogo em forma de apresentação, uma vez por widgetKey. O desenho do ícone
  // não vai aqui dentro: `icones` viaja uma vez só e o renderer resolve pelo nome,
  // senão os desenhos seriam repetidos em cada uma das 77 entradas.
  const catalogo = {};
  for (const [chave, def] of Object.entries(catalogoBruto)) {
    const o = def.options || {};
    catalogo[chave] = {
      type: def.type,
      w: def.w,
      h: def.h,
      label: o.label || "",
      mostrarLabel: o.showLabel !== false,
      texto: o.text || null,
      tamanhoFonte: o.fontSize || null,
      cores: resolverCores(o.cores),
      iconName: typeof o.iconName === "string" ? o.iconName : null,
    };
  }

  montado = {
    tamanhoCelula: TAMANHO_CELULA,
    tela: telaAtual,
    itens: layoutAtual || carregar("layout-padrao.json"),
    catalogo,
    icones,
    catalogoBruto,
  };
  return montado;
}

// `bruto` é a mesma string que o server.js manda ao tablet: "null", um objeto de
// menu/erro, ou a telemetria completa.
function avaliarPainel(bruto) {
  const { avaliarAtivo, formatarValor } = carregar("avaliador");
  const { itens, catalogo, catalogoBruto } = montarPainel();

  let telemetria = null;
  let estado = "sem-jogo";

  if (bruto && bruto !== "null") {
    try {
      telemetria = JSON.parse(bruto);
    } catch {
      telemetria = null;
    }
  }
  if (telemetria) {
    if (telemetria.erro === "schema") estado = "schema";
    else if (telemetria.jogoRodando === false) estado = "menu";
    else estado = "ativo";
  }

  const aoVivo = estado === "ativo";
  const estados = {};

  for (const item of itens) {
    const base = catalogoBruto[item.widgetKey];
    if (!base) continue;
    // Os descritores podem ser sobrescritos pelo item, como qualquer opção.
    const options = { ...base.options, ...item.options };
    const tipo = catalogo[item.widgetKey].type;
    const linha = { ativo: aoVivo && avaliarAtivo(options.ativoSe, telemetria) };

    if (tipo === "DataDisplay") {
      linha.texto = aoVivo ? String(formatarValor(options.valor, telemetria)) : "--";
    } else if (tipo === "FuelGauge") {
      const litros = telemetria && telemetria.combustivel;
      linha.texto =
        aoVivo && typeof litros === "number" ? `${Math.round(litros)} L` : "--";
    }
    estados[item.id] = linha;
  }

  return { estado, aoVivo, widgets: estados };
}

// O catálogo bruto só interessa ao avaliarPainel; a janela não precisa dele.
function painelParaJanela() {
  const { tamanhoCelula, tela, itens, catalogo, icones } = montarPainel();
  return { tamanhoCelula, tela, itens, catalogo, icones };
}

module.exports = { painelParaJanela, avaliarPainel, definirLayout };
