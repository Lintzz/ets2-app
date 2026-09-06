// Dashlz servidor/dashboard_editor.js
// Modo edição da janela do painel: selecionar, arrastar, redimensionar, apagar e
// acrescentar widgets da paleta.
//
// Trabalha sobre o **layout cru** (`itens`), o mesmo formato que vai para o disco e
// para o tablet — nada é traduzido no caminho. O desenho continua sendo do
// dashboard_renderer.js: aqui só se mexe em `itens` e se pede uma remontagem, ou,
// durante um arrasto, se mexe direto no estilo do nó (remontar a cada pixel seria
// caro e faria o widget piscar).
//
// Nada daqui envolve teclas nem robotjs: o editor mexe em posição e tamanho, e a
// janela continua sendo somente leitura no que diz respeito ao jogo.

const MAX_HISTORICO = 50;

export function iniciarEditor(ctx) {
  const {
    CELULA,
    catalogo,
    elementoIcone,
    remontar,
    escalaAtual,
    origemAtual,
    tela,
    palco,
    obterItens,
    definirItens,
    obterTela,
    definirTela,
    layoutAtivoId,
    ehPadrao,
    pedirNome,
  } = ctx;

  const btEditar = document.getElementById("editar-btn");
  const btSalvar = document.getElementById("salvar-btn");
  const btDescartar = document.getElementById("descartar-btn");
  const btApagar = document.getElementById("apagar-btn");
  const paleta = document.getElementById("paleta");
  const campoColunas = document.getElementById("tela-colunas");
  const campoLinhas = document.getElementById("tela-linhas");
  const aviso = document.getElementById("editor-aviso");
  const rodapeModo = document.getElementById("aviso-leitura");

  let editando = false;
  let sujo = false;
  let selecionado = null; // id
  let historico = [];
  let salvo = null; // instantâneo do que está em disco

  const clonar = (v) => JSON.parse(JSON.stringify(v));
  const instantaneo = () => ({ itens: clonar(obterItens()), tela: clonar(obterTela()) });

  // --- Estado da barra ------------------------------------------------------

  function pintarBarra() {
    document.body.classList.toggle("editando", editando);
    btEditar.textContent = editando ? "Sair da edição" : "Editar";
    btSalvar.hidden = !editando;
    btDescartar.hidden = !editando;
    btApagar.hidden = !editando;
    btApagar.disabled = !selecionado;
    btSalvar.disabled = !sujo;
    btDescartar.disabled = !sujo;
    btSalvar.textContent = sujo ? "Salvar ●" : "Salvar";
    // Fora da edição a janela é mesmo só leitura; dentro, deixaria de ser verdade.
    rodapeModo.textContent = editando
      ? "editando — nada é enviado ao jogo"
      : "somente leitura — espelho do tablet";
  }

  function marcarSujo() {
    sujo = true;
    pintarBarra();
    conferirMoldura();
  }

  function mostrarAviso(texto) {
    aviso.textContent = texto || "";
    aviso.hidden = !texto;
  }

  // Widget fora da moldura não some nem é impedido: só é apontado. Quem decide o
  // que cabe na tela do tablet é o dono do painel.
  function conferirMoldura() {
    const molde = obterTela();
    if (!editando || !molde) return mostrarAviso("");
    const fora = obterItens().filter((it) => {
      const base = catalogo[it.widgetKey];
      if (!base) return false;
      const w = it.w ?? base.w;
      const h = it.h ?? base.h;
      return it.x + w > molde.colunas || it.y + h > molde.linhas;
    });
    mostrarAviso(
      fora.length ? `${fora.length} widget(s) fora da tela de ${molde.colunas}×${molde.linhas}` : ""
    );
  }

  // --- Histórico ------------------------------------------------------------

  function guardar() {
    historico.push(instantaneo());
    if (historico.length > MAX_HISTORICO) historico.shift();
  }

  function desfazer() {
    const anterior = historico.pop();
    if (!anterior) return;
    definirItens(anterior.itens);
    definirTela(anterior.tela);
    sincronizarCamposDaTela();
    selecionado = null;
    remontar();
    aplicarModo();
    sujo = historico.length > 0 || JSON.stringify(instantaneo()) !== JSON.stringify(salvo);
    pintarBarra();
    conferirMoldura();
  }

  // --- Seleção --------------------------------------------------------------

  function selecionar(id) {
    selecionado = id;
    for (const no of tela.children) {
      no.classList.toggle("selecionado", no.dataset.id === id);
    }
    pintarBarra();
  }

  // O handle de resize é um filho do widget selecionado, criado sob demanda.
  function aplicarModo() {
    for (const no of tela.children) {
      no.classList.toggle("editavel", editando);
      no.querySelector(".alca")?.remove();
      if (editando) {
        const alca = document.createElement("span");
        alca.className = "alca";
        no.appendChild(alca);
      }
    }
    if (selecionado) selecionar(selecionado);
  }

  function apagarSelecionado() {
    if (!selecionado) return;
    guardar();
    definirItens(obterItens().filter((it) => it.id !== selecionado));
    selecionado = null;
    remontar();
    aplicarModo();
    marcarSujo();
  }

  // --- Arrastar e redimensionar ---------------------------------------------

  let arrasto = null;

  function aoApertar(e) {
    if (!editando || e.button !== 0) return;
    const no = e.target.closest(".widget");
    if (!no) {
      selecionar(null);
      return;
    }
    const id = no.dataset.id;
    const item = obterItens().find((it) => it.id === id);
    if (!item) return;

    selecionar(id);
    const base = catalogo[item.widgetKey];

    arrasto = {
      tipo: e.target.classList.contains("alca") ? "tamanho" : "posicao",
      id,
      no,
      xInicial: e.clientX,
      yInicial: e.clientY,
      x: item.x,
      y: item.y,
      w: item.w ?? base.w,
      h: item.h ?? base.h,
      moveu: false,
    };
    // Sem a captura o arrasto morre se o cursor sair do widget. Falha em
    // ponteiro sintético, e aí o arrasto ainda funciona pelo listener da tela.
    try {
      no.setPointerCapture(e.pointerId);
    } catch {
      /* segue sem captura */
    }
    e.preventDefault();
  }

  function aoMover(e) {
    if (!arrasto) return;
    // Dividir pela escala do zoom: sem isto o widget foge do cursor em qualquer
    // zoom diferente de 100%, que é o padrão assim que a janela é menor que o painel.
    const escala = escalaAtual() || 1;
    const dx = Math.round((e.clientX - arrasto.xInicial) / escala / CELULA);
    const dy = Math.round((e.clientY - arrasto.yInicial) / escala / CELULA);
    if (dx === 0 && dy === 0 && !arrasto.moveu) return;

    if (!arrasto.moveu) {
      arrasto.moveu = true;
      guardar();
    }

    const origem = origemAtual();
    if (arrasto.tipo === "posicao") {
      arrasto.novoX = Math.max(0, arrasto.x + dx);
      arrasto.novoY = Math.max(0, arrasto.y + dy);
      arrasto.no.style.left = `${(arrasto.novoX - origem.x) * CELULA}px`;
      arrasto.no.style.top = `${(arrasto.novoY - origem.y) * CELULA}px`;
    } else {
      arrasto.novoW = Math.max(1, arrasto.w + dx);
      arrasto.novoH = Math.max(1, arrasto.h + dy);
      arrasto.no.style.width = `${arrasto.novoW * CELULA}px`;
      arrasto.no.style.height = `${arrasto.novoH * CELULA}px`;
    }
  }

  function aoSoltar() {
    if (!arrasto) return;
    const a = arrasto;
    arrasto = null;
    if (!a.moveu) return;

    const itens = obterItens();
    const item = itens.find((it) => it.id === a.id);
    if (item) {
      if (a.tipo === "posicao") {
        item.x = a.novoX ?? a.x;
        item.y = a.novoY ?? a.y;
      } else {
        item.w = a.novoW ?? a.w;
        item.h = a.novoH ?? a.h;
      }
    }
    definirItens(itens);
    // Remontar corrige o tamanho do ícone (que depende de w/h) e a área do palco.
    remontar();
    aplicarModo();
    selecionar(a.id);
    marcarSujo();
  }

  tela.addEventListener("pointerdown", aoApertar);
  tela.addEventListener("pointermove", aoMover);
  tela.addEventListener("pointerup", aoSoltar);
  tela.addEventListener("pointercancel", () => {
    arrasto = null;
    remontar();
    aplicarModo();
  });

  // --- Paleta ---------------------------------------------------------------

  const NOMES_TIPO = {
    IconButton: "Botões",
    CircularButton: "Botões",
    Alert: "Alertas",
    DataDisplay: "Mostradores",
    FuelGauge: "Mostradores",
    ColorArea: "Decoração",
    TextWidget: "Decoração",
  };

  function montarPaleta() {
    const grupos = new Map();
    for (const [chave, def] of Object.entries(catalogo)) {
      const grupo = NOMES_TIPO[def.type] || "Outros";
      if (!grupos.has(grupo)) grupos.set(grupo, []);
      grupos.get(grupo).push([chave, def]);
    }

    paleta.replaceChildren();
    for (const [grupo, entradas] of [...grupos].sort()) {
      const titulo = document.createElement("div");
      titulo.className = "paleta-grupo";
      titulo.textContent = `${grupo} (${entradas.length})`;
      paleta.appendChild(titulo);

      for (const [chave, def] of entradas.sort((a, b) => a[1].label.localeCompare(b[1].label))) {
        const linha = document.createElement("button");
        linha.className = "paleta-item";
        linha.dataset.chave = chave;
        linha.title = `${def.label} — ${def.w}×${def.h}`;
        linha.appendChild(elementoIcone(def.iconName, 16));
        const nome = document.createElement("span");
        nome.textContent = def.label || chave;
        linha.appendChild(nome);
        linha.onclick = () => acrescentar(chave);
        linha.addEventListener("pointerdown", (e) => comecarDaPaleta(e, chave, def));
        paleta.appendChild(linha);
      }
    }
  }

  // Arrastar da paleta para a grade. Um clique sem mover cai no onclick e usa a
  // primeira célula livre; arrastar solta onde o cursor estiver. Soltar fora da
  // grade cancela — é o gesto que o usuário espera para desistir.
  let daPaleta = null;

  function comecarDaPaleta(e, chave, def) {
    if (!editando || e.button !== 0) return;
    const fantasma = document.createElement("div");
    fantasma.className = "fantasma";
    fantasma.style.width = `${def.w * CELULA * escalaAtual()}px`;
    fantasma.style.height = `${def.h * CELULA * escalaAtual()}px`;
    fantasma.textContent = def.label || chave;
    document.body.appendChild(fantasma);
    daPaleta = { chave, def, fantasma, moveu: false };
    moverFantasma(e);
    e.preventDefault();
  }

  function moverFantasma(e) {
    if (!daPaleta) return;
    daPaleta.fantasma.style.left = `${e.clientX + 8}px`;
    daPaleta.fantasma.style.top = `${e.clientY + 8}px`;
  }

  window.addEventListener("pointermove", (e) => {
    if (!daPaleta) return;
    daPaleta.moveu = true;
    moverFantasma(e);
  });

  window.addEventListener("pointerup", (e) => {
    if (!daPaleta) return;
    const { chave, moveu, fantasma } = daPaleta;
    daPaleta = null;
    fantasma.remove();
    if (!moveu) return; // clique puro: o onclick já cuidou

    const r = tela.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      return; // soltou fora da grade: desistiu
    }
    const escala = escalaAtual() || 1;
    const origem = origemAtual();
    const x = Math.max(0, Math.floor((e.clientX - r.left) / escala / CELULA) + origem.x);
    const y = Math.max(0, Math.floor((e.clientY - r.top) / escala / CELULA) + origem.y);
    acrescentar(chave, { x, y });
  });

  // Coloca o widget novo na posição pedida, ou na primeira célula livre.
  function acrescentar(chave, posicao) {
    const base = catalogo[chave];
    if (!base) return;
    guardar();

    const itens = obterItens();
    const ocupadas = new Set(itens.map((it) => `${it.x},${it.y}`));
    const molde = obterTela();
    const colunas = molde ? molde.colunas : 40;

    let x = 0;
    let y = 0;
    busca: for (let ly = 0; ly < 200; ly++) {
      for (let lx = 0; lx + base.w <= colunas; lx++) {
        if (!ocupadas.has(`${lx},${ly}`)) {
          x = lx;
          y = ly;
          break busca;
        }
      }
    }

    const id = `${chave}-${Date.now()}`;
    if (posicao) {
      x = posicao.x;
      y = posicao.y;
    }
    itens.push({ id, widgetKey: chave, x, y, w: base.w, h: base.h });
    definirItens(itens);
    remontar();
    aplicarModo();
    selecionar(id);
    marcarSujo();
  }

  // --- Moldura --------------------------------------------------------------

  function sincronizarCamposDaTela() {
    const molde = obterTela();
    campoColunas.value = molde ? molde.colunas : "";
    campoLinhas.value = molde ? molde.linhas : "";
  }

  function mudarTela() {
    const colunas = parseInt(campoColunas.value, 10);
    const linhas = parseInt(campoLinhas.value, 10);
    if (!Number.isInteger(colunas) || !Number.isInteger(linhas)) return;
    if (colunas < 1 || linhas < 1 || colunas > 200 || linhas > 200) return;
    guardar();
    definirTela({ colunas, linhas });
    remontar();
    aplicarModo();
    marcarSujo();
  }

  campoColunas.onchange = mudarTela;
  campoLinhas.onchange = mudarTela;

  // --- Entrar, sair, salvar -------------------------------------------------

  // Entrar no editor garante uma moldura: com ela a origem do grid é (0,0) e a
  // conta de arrastar fica direta. O layout de fábrica não tem moldura e não é
  // editável, então nada é alterado nele por causa disto.
  function garantirMoldura() {
    if (obterTela()) return;
    const itens = obterItens();
    let colunas = 1;
    let linhas = 1;
    for (const it of itens) {
      const base = catalogo[it.widgetKey];
      if (!base) continue;
      colunas = Math.max(colunas, it.x + (it.w ?? base.w));
      linhas = Math.max(linhas, it.y + (it.h ?? base.h));
    }
    definirTela({ colunas, linhas });
  }

  function entrar() {
    // O padrão é o chão do sistema e não se edita; duplicar primeiro.
    if (ehPadrao()) {
      pedirNome("duplicar-e-editar", "Meu painel");
      return;
    }
    editando = true;
    garantirMoldura();
    sincronizarCamposDaTela();
    salvo = instantaneo();
    historico = [];
    sujo = false;
    remontar();
    aplicarModo();
    pintarBarra();
    conferirMoldura();
  }

  function sair() {
    editando = false;
    selecionado = null;
    remontar();
    aplicarModo();
    pintarBarra();
    mostrarAviso("");
  }

  function descartar() {
    if (!salvo) return;
    definirItens(clonar(salvo.itens));
    definirTela(clonar(salvo.tela));
    historico = [];
    sujo = false;
    selecionado = null;
    sincronizarCamposDaTela();
    remontar();
    aplicarModo();
    pintarBarra();
    conferirMoldura();
  }

  async function salvar() {
    const r = await window.servidor.layout.salvar(
      layoutAtivoId(),
      obterItens(),
      obterTela()
    );
    if (!r || !r.ok) {
      mostrarAviso(r ? r.mensagem : "Não foi possível salvar.");
      return;
    }
    salvo = instantaneo();
    historico = [];
    sujo = false;
    pintarBarra();
    conferirMoldura();
  }

  btEditar.onclick = () => (editando ? sair() : entrar());
  btSalvar.onclick = salvar;
  btDescartar.onclick = descartar;
  btApagar.onclick = apagarSelecionado;

  window.addEventListener("keydown", (e) => {
    if (!editando) return;
    if (e.key === "Delete" && selecionado) {
      apagarSelecionado();
      e.preventDefault();
    }
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      desfazer();
      e.preventDefault();
    }
    if (e.key === "Escape") selecionar(null);
  });

  // Fechar com mudança pendente perderia o trabalho em silêncio.
  window.addEventListener("beforeunload", (e) => {
    if (!sujo) return;
    e.preventDefault();
    e.returnValue = "";
  });

  montarPaleta();
  pintarBarra();

  // Depois de "duplicar para editar" a janela é recarregada pelo main; a marca no
  // sessionStorage é o que faz o editor abrir já no preset novo.
  if (sessionStorage.getItem("editar-ao-abrir")) {
    sessionStorage.removeItem("editar-ao-abrir");
    if (!ehPadrao()) entrar();
  }
}
