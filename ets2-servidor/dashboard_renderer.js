// Dashlz servidor/dashboard_renderer.js
// Desenha o espelho do painel do tablet. Só DOM: quem conhece o catálogo e os
// descritores é o processo principal (painel.js), que entrega o catálogo resolvido
// e o layout cru, e a cada quadro só o estado de cada widget — aceso/apagado e o
// texto. Assim o avaliador continua existindo num arquivo só, em compartilhado/,
// e esta página não tem como divergir do app por conta própria.
//
// O layout chega **cru** de propósito: é ele que o editor devolve ao salvar, então
// o merge com o catálogo acontece aqui, em `resolver()`, e não no main.

import { iniciarEditor } from "./dashboard_editor.js";

const tela = document.getElementById("tela");
const palco = document.getElementById("palco");
const faixa = document.getElementById("faixa");
const ponto = document.getElementById("ponto");
const estadoTexto = document.getElementById("estado-texto");
const selo = document.getElementById("selo-widgets");

const painel = await window.servidor.dashboard.painel();
const CELULA = painel.tamanhoCelula;
const catalogo = painel.catalogo;
const icones = painel.icones;

// O editor mexe nestes dois; por isso são `let` e não constantes.
let itens = painel.itens;
let telaCfg = painel.tela;

// --- Resolução --------------------------------------------------------------

// Mesmo merge do rehydrateLayout do app: o catálogo diz o que o widget é, o item
// diz onde ele fica e pode sobrescrever tamanho e opções.
function resolver(item) {
  const base = catalogo[item.widgetKey];
  if (!base) return null;
  const o = item.options || {};
  return {
    id: item.id,
    widgetKey: item.widgetKey,
    type: base.type,
    x: item.x,
    y: item.y,
    w: item.w ?? base.w,
    h: item.h ?? base.h,
    label: o.label ?? base.label,
    mostrarLabel: o.showLabel !== undefined ? o.showLabel !== false : base.mostrarLabel,
    texto: o.text ?? base.texto,
    tamanhoFonte: o.fontSize ?? base.tamanhoFonte,
    cores: o.cores ? { ...base.cores, ...o.cores } : base.cores,
    iconName: o.iconName ?? base.iconName,
  };
}

function desenhoDoIcone(nome) {
  if (typeof nome !== "string") return null;
  if (nome.startsWith("svg:")) {
    const d = icones.svg[nome.slice(4)];
    return d ? { tipo: "svg", ...d } : null;
  }
  const d = icones.mdi[nome];
  return d ? { tipo: "mdi", d } : null;
}

// iconeAtiva -> --cor-icone-ativa
const emKebab = (nome) => nome.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);

export function elementoIcone(nome, tamanho) {
  const caixa = document.createElement("span");
  caixa.className = "icone";
  const icone = desenhoDoIcone(nome);
  if (!icone) return caixa;

  if (tamanho) {
    caixa.style.width = `${tamanho}px`;
    caixa.style.height = `${tamanho}px`;
  }
  // Os desenhos vêm de dashboard/icones.json, gerado por scripts/gerar-icones.js
  // a partir do @mdi/js e dos SVGs do app — nada aqui vem de fora.
  caixa.innerHTML =
    icone.tipo === "mdi"
      ? `<svg viewBox="0 0 24 24"><path d="${icone.d}"></path></svg>`
      : `<svg viewBox="${icone.viewBox}">${icone.corpo}</svg>`;
  return caixa;
}

// --- Montagem ---------------------------------------------------------------

// Guardado por id: o laço de telemetria só mexe nestes nós.
const nos = new Map();

// Sem moldura declarada, o retângulo é medido — o layout de fábrica começa na
// coluna/linha 1, e sem essa correção sobraria uma folga fixa à esquerda e no topo.
let origem = { x: 0, y: 0 };
let LARGURA = 0;
let ALTURA = 0;

function calcularArea() {
  if (telaCfg) {
    origem = { x: 0, y: 0 };
    LARGURA = telaCfg.colunas * CELULA;
    ALTURA = telaCfg.linhas * CELULA;
    return;
  }
  const resolvidos = itens.map(resolver).filter(Boolean);
  if (!resolvidos.length) {
    origem = { x: 0, y: 0 };
    LARGURA = CELULA;
    ALTURA = CELULA;
    return;
  }
  const minX = Math.min(...resolvidos.map((w) => w.x));
  const minY = Math.min(...resolvidos.map((w) => w.y));
  const maxX = Math.max(...resolvidos.map((w) => w.x + w.w));
  const maxY = Math.max(...resolvidos.map((w) => w.y + w.h));
  origem = { x: minX, y: minY };
  LARGURA = (maxX - minX) * CELULA;
  ALTURA = (maxY - minY) * CELULA;
}

export const origemAtual = () => origem;

function construirWidget(w) {
  const caixa = document.createElement("div");
  caixa.className = "widget";
  caixa.dataset.id = w.id;
  caixa.style.left = `${(w.x - origem.x) * CELULA}px`;
  caixa.style.top = `${(w.y - origem.y) * CELULA}px`;
  caixa.style.width = `${w.w * CELULA}px`;
  caixa.style.height = `${w.h * CELULA}px`;

  // A paleta chega resolvida do painel.js. Escrever como custom properties deixa
  // o CSS decidir quem usa o quê, e o par aceso/apagado troca só pela classe.
  for (const [nome, valor] of Object.entries(w.cores)) {
    caixa.style.setProperty(`--cor-${emKebab(nome)}`, valor);
  }

  const registro = { caixa, valor: null };

  switch (w.type) {
    case "ColorArea": {
      const area = document.createElement("div");
      area.className = "area";
      area.style.background = w.cores.fundo;
      caixa.appendChild(area);
      break;
    }

    case "TextWidget": {
      const texto = document.createElement("span");
      texto.className = "texto";
      texto.textContent = w.texto || "Texto";
      texto.style.fontSize = `${w.tamanhoFonte || 24}px`;
      caixa.appendChild(texto);
      break;
    }

    // CircularButton e IconButton desenham igual no app; aqui também.
    case "CircularButton":
    case "IconButton": {
      const botao = document.createElement("div");
      botao.className = "botao";
      const lado = Math.min(w.w * CELULA, w.h * CELULA) * 0.6;
      botao.appendChild(elementoIcone(w.iconName, lado));
      caixa.appendChild(botao);
      if (w.mostrarLabel && w.label) {
        const rotulo = document.createElement("span");
        rotulo.className = "rotulo-botao";
        rotulo.textContent = w.label;
        caixa.appendChild(rotulo);
      }
      break;
    }

    case "DataDisplay":
    case "FuelGauge": {
      const mostrador = document.createElement("div");
      mostrador.className = "mostrador";
      const rot = document.createElement("span");
      rot.className = "rot";
      rot.textContent = w.label || (w.type === "FuelGauge" ? "COMBUSTÍVEL" : "");
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = "--";
      mostrador.appendChild(rot);
      mostrador.appendChild(val);
      caixa.appendChild(mostrador);
      registro.valor = val;
      break;
    }

    case "Alert": {
      const alerta = document.createElement("div");
      alerta.className = "alerta";
      alerta.appendChild(elementoIcone(w.iconName));
      if (w.mostrarLabel && w.label) {
        const rotulo = document.createElement("span");
        rotulo.className = "rotulo";
        rotulo.textContent = w.label;
        alerta.appendChild(rotulo);
      }
      caixa.appendChild(alerta);
      break;
    }

    default: {
      const erro = document.createElement("span");
      erro.style.color = "red";
      erro.style.fontSize = "10px";
      erro.textContent = `Tipo: ${w.type}?`;
      caixa.appendChild(erro);
    }
  }

  return registro;
}

// Redesenha o painel a partir de `itens`. Barato o bastante para o editor chamar a
// cada mudança estrutural (adicionar, apagar, mexer na moldura); arrastar e
// redimensionar mexem só no estilo do nó, sem passar por aqui.
export function remontar() {
  calcularArea();
  tela.style.width = `${LARGURA}px`;
  tela.style.height = `${ALTURA}px`;
  tela.replaceChildren();
  nos.clear();

  for (const item of itens) {
    const w = resolver(item);
    if (!w) continue;
    const registro = construirWidget(w);
    tela.appendChild(registro.caixa);
    nos.set(w.id, registro);
  }

  selo.textContent = `${nos.size} widgets`;
  aplicarEscala();
}

// --- Zoom -------------------------------------------------------------------

let escala = 1;
let ajustarSozinho = true;

export const escalaAtual = () => escala;

function aplicarEscala() {
  tela.style.transform = `scale(${escala})`;
  // O transform não muda o espaço ocupado no fluxo, então o palco não sabe
  // rolar para um painel maior que a janela. A margem devolve o tamanho real.
  const sobraX = LARGURA * (escala - 1);
  const sobraY = ALTURA * (escala - 1);
  tela.style.margin = `${sobraY / 2}px ${sobraX / 2}px`;
  document.getElementById("zoom-valor").textContent = `${Math.round(escala * 100)}%`;
}

function ajustarAJanela() {
  const caixa = palco.getBoundingClientRect();
  const folga = 24;
  escala = Math.min((caixa.width - folga) / LARGURA, (caixa.height - folga) / ALTURA, 1);
  aplicarEscala();
}

function mudarZoom(delta) {
  ajustarSozinho = false;
  escala = Math.min(2, Math.max(0.2, escala + delta));
  aplicarEscala();
}

document.getElementById("zoom-mais").onclick = () => mudarZoom(0.1);
document.getElementById("zoom-menos").onclick = () => mudarZoom(-0.1);
document.getElementById("zoom-ajustar").onclick = () => {
  ajustarSozinho = true;
  ajustarAJanela();
};

window.addEventListener("resize", () => {
  if (ajustarSozinho) ajustarAJanela();
});

remontar();
ajustarAJanela();

// --- Telemetria -------------------------------------------------------------

const ESTADOS = {
  ativo: { texto: "Transmitindo", cor: "oklch(0.82 0.19 145)", pulsa: true },
  menu: {
    texto: "Jogo no menu ou pausado",
    cor: "oklch(0.85 0.15 85)",
    // Mesma frase do avisoMenu do app, para o espelho não inventar texto.
    faixa: "JOGO NO MENU · botões ativos, dados pausados",
  },
  "sem-jogo": { texto: "Jogo (ETS2) não detectado", cor: "#5f6e6a" },
  schema: { texto: "Plugin do jogo desatualizado", cor: "oklch(0.7 0.2 25)" },
  parado: { texto: "Aguardando telemetria…", cor: "#5f6e6a" },
};

function mostrarEstado(chave) {
  const e = ESTADOS[chave] || ESTADOS.parado;
  estadoTexto.textContent = e.texto;
  ponto.style.setProperty("--cor-estado", e.cor);
  ponto.classList.toggle("vivo", !!e.pulsa);
  faixa.hidden = !e.faixa;
  if (e.faixa) faixa.textContent = e.faixa;
}

mostrarEstado("parado");

// Sem tablet e sem jogo o servidor ainda tica, mas se o processo do servidor cair
// os quadros simplesmente param de chegar — sem isto o painel ficaria congelado
// no último estado, parecendo telemetria de verdade.
let semQuadros = null;
function reiniciarVigia() {
  clearTimeout(semQuadros);
  semQuadros = setTimeout(() => mostrarEstado("parado"), 2000);
}

window.servidor.dashboard.aoReceberTelemetria((quadro) => {
  reiniciarVigia();
  mostrarEstado(quadro.estado);

  for (const [id, estado] of Object.entries(quadro.widgets)) {
    const no = nos.get(id);
    if (!no) continue;
    no.caixa.classList.toggle("aceso", estado.ativo);
    if (no.valor && estado.texto !== undefined) no.valor.textContent = estado.texto;
  }
});

// --- Presets ----------------------------------------------------------------
//
// Trocar, duplicar, renomear e excluir. Quem grava é o processo principal
// (layouts.js); trocar o preset ativo faz o main recarregar esta janela, então não
// há remontagem manual.

const lista = document.getElementById("layout-lista");
const caixaNome = document.getElementById("layout-nome-caixa");
const campoNome = document.getElementById("layout-nome");
const btDuplicar = document.getElementById("layout-duplicar");
const btRenomear = document.getElementById("layout-renomear");
const btExcluir = document.getElementById("layout-excluir");

let estadoLayouts = { ativo: "padrao", lista: [] };
let acaoPendente = null; // "duplicar" | "renomear" | "duplicar-e-editar"

export const layoutAtivoId = () => estadoLayouts.ativo;
export const ehPadrao = () => estadoLayouts.ativo === "padrao";

function pintarLayouts() {
  lista.replaceChildren(
    ...estadoLayouts.lista.map((l) => {
      const opcao = document.createElement("option");
      opcao.value = l.id;
      opcao.textContent = l.nome;
      opcao.selected = l.id === estadoLayouts.ativo;
      return opcao;
    })
  );
  // O padrão é o chão: não se renomeia nem se apaga, senão dá para ficar sem layout.
  const ativo = estadoLayouts.lista.find((l) => l.id === estadoLayouts.ativo);
  const editavel = Boolean(ativo && ativo.editavel);
  btRenomear.disabled = !editavel;
  btExcluir.disabled = !editavel;
}

// window.prompt não existe no Electron, então o nome é pedido aqui na barra mesmo.
export function pedirNome(acao, sugestao) {
  acaoPendente = acao;
  campoNome.value = sugestao;
  caixaNome.hidden = false;
  campoNome.focus();
  campoNome.select();
}

function fecharNome() {
  acaoPendente = null;
  caixaNome.hidden = true;
}

async function aplicar(resposta) {
  if (resposta && resposta.estado) {
    estadoLayouts = resposta.estado;
    pintarLayouts();
  }
  fecharNome();
  return resposta;
}

lista.onchange = async () => {
  await aplicar(await window.servidor.layout.ativar(lista.value));
};

btDuplicar.onclick = () => {
  const atual = estadoLayouts.lista.find((l) => l.id === estadoLayouts.ativo);
  pedirNome("duplicar", `${atual ? atual.nome : "Layout"} (cópia)`);
};

btRenomear.onclick = () => {
  const atual = estadoLayouts.lista.find((l) => l.id === estadoLayouts.ativo);
  pedirNome("renomear", atual ? atual.nome : "");
};

btExcluir.onclick = async () => {
  await aplicar(await window.servidor.layout.excluir(estadoLayouts.ativo));
};

document.getElementById("layout-ok").onclick = async () => {
  const nome = campoNome.value;
  const acao = acaoPendente;
  if (!acao) return;
  fecharNome();

  if (acao === "renomear") {
    await aplicar(await window.servidor.layout.renomear(estadoLayouts.ativo, nome));
    return;
  }
  // Duplicar troca o preset ativo, e o main recarrega a janela em seguida; quem
  // pediu "duplicar para editar" entra no editor depois do recarregamento.
  if (acao === "duplicar-e-editar") sessionStorage.setItem("editar-ao-abrir", "1");
  await aplicar(await window.servidor.layout.duplicar(estadoLayouts.ativo, nome));
};

document.getElementById("layout-cancelar").onclick = fecharNome;
campoNome.onkeydown = (e) => {
  if (e.key === "Enter") document.getElementById("layout-ok").click();
  if (e.key === "Escape") fecharNome();
};

// O painel é o motivo da janela; a barra de presets é acessório. Se ela falhar,
// fica vazia em vez de abortar o módulo e levar o espelho junto.
try {
  estadoLayouts = await window.servidor.layout.estado();
  pintarLayouts();
} catch (e) {
  console.error("Não foi possível listar os layouts:", e);
  lista.disabled = true;
  btDuplicar.disabled = true;
  btRenomear.disabled = true;
  btExcluir.disabled = true;
}

// --- Editor -----------------------------------------------------------------

iniciarEditor({
  CELULA,
  catalogo,
  elementoIcone,
  remontar,
  escalaAtual,
  origemAtual,
  tela,
  palco,
  obterItens: () => itens,
  definirItens: (novos) => {
    itens = novos;
  },
  obterTela: () => telaCfg,
  definirTela: (nova) => {
    telaCfg = nova;
  },
  layoutAtivoId,
  ehPadrao,
  pedirNome,
});

// --- Controles da janela ----------------------------------------------------

document.getElementById("minimize-btn").onclick = () => window.servidor.minimizar();
document.getElementById("maximize-btn").onclick = () => window.servidor.maximizar();
document.getElementById("close-btn").onclick = () => window.servidor.fechar();
