// Dashlz servidor/layouts.js
// Os layouts do painel, guardados em userData/layouts.json.
//
// Roda no processo principal, como painel.js e pelo mesmo motivo: o preload é
// sandboxed e não alcança o disco nem a pasta compartilhado/.
//
// O layout de fábrica NÃO fica no arquivo. Ele é o `compartilhado/layout-padrao.json`
// embutido, sempre disponível sob o id "padrao". Assim "Restaurar padrão" funciona
// mesmo com o arquivo corrompido ou ausente, e uma instalação nova começa sem
// arquivo nenhum. Empacotado, compartilhado/ vive em resources/ e é somente-leitura,
// então o que o usuário edita tem que ir para userData de qualquer forma.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const ID_PADRAO = "padrao";
const NOME_PADRAO = "Padrão";
const MAX_LAYOUTS = 20;
const MAX_NOME = 40;

function pastaCompartilhada() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "compartilhado")
    : path.join(__dirname, "..", "compartilhado");
}

const carregar = (nome) => require(path.join(pastaCompartilhada(), nome));

const ARQUIVO = () => path.join(app.getPath("userData"), "layouts.json");

// --- Disco -----------------------------------------------------------------

function ler() {
  try {
    const dados = JSON.parse(fs.readFileSync(ARQUIVO(), "utf8"));
    return {
      ativo: typeof dados.ativo === "string" ? dados.ativo : ID_PADRAO,
      layouts: Array.isArray(dados.layouts) ? dados.layouts : [],
    };
  } catch {
    // Arquivo ausente na primeira execução, ou ilegível: o padrão sempre serve.
    return { ativo: ID_PADRAO, layouts: [] };
  }
}

// Escrita atômica. O salvarConfig do main.js escreve direto, o que para duas
// chaves custa pouco; aqui um corte no meio levaria todos os layouts do usuário.
function gravar(dados) {
  const destino = ARQUIVO();
  const temporario = `${destino}.tmp`;
  try {
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
    fs.renameSync(temporario, destino);
    return { ok: true };
  } catch (e) {
    try {
      fs.unlinkSync(temporario);
    } catch {
      /* nem chegou a existir */
    }
    return { ok: false, mensagem: `Não foi possível salvar os layouts: ${e.message}` };
  }
}

// --- Consulta ---------------------------------------------------------------

function widgetsDoPadrao() {
  return carregar("layout-padrao.json");
}

// Lista para a interface. O padrão vem sempre primeiro e não pode ser apagado
// nem renomeado — é o chão que garante que sempre há um layout válido.
function estado() {
  const { ativo, layouts } = ler();
  const lista = [
    { id: ID_PADRAO, nome: NOME_PADRAO, editavel: false },
    ...layouts.map((l) => ({ id: l.id, nome: l.nome, editavel: true })),
  ];
  const existe = lista.some((l) => l.id === ativo);
  return { ativo: existe ? ativo : ID_PADRAO, lista };
}

// Widgets do layout ativo, já validados. Se o ativo sumiu ou não valida, cai no
// padrão em vez de devolver tela vazia.
function layoutAtivo() {
  const catalogo = carregar("catalogo-widgets.json");
  const { validarLayout } = carregar("validar-layout");
  const { ativo, layouts } = ler();

  // O padrão não tem `tela`: sem ela o app volta a medir os limites e centralizar,
  // que é o comportamento de sempre.
  const cair = (motivo) => ({
    id: ID_PADRAO,
    nome: NOME_PADRAO,
    tela: null,
    widgets: widgetsDoPadrao(),
    erros: motivo ? [motivo] : [],
  });

  const escolhido = layouts.find((l) => l.id === ativo);
  if (!escolhido) return cair(null);

  const r = validarLayout(escolhido.widgets, catalogo, { tela: escolhido.tela });
  if (!r.ok) {
    const queda = cair(`Layout "${escolhido.nome}" não tem nenhum widget válido; usando o padrão.`);
    queda.erros.push(...r.erros);
    return queda;
  }
  return {
    id: escolhido.id,
    nome: escolhido.nome,
    tela: r.tela,
    widgets: r.layout,
    erros: r.erros,
  };
}

// --- Alterações -------------------------------------------------------------

const limparNome = (nome) =>
  (typeof nome === "string" ? nome : "").trim().slice(0, MAX_NOME);

function novoId(nome, existentes) {
  const base =
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "layout";
  let id = base;
  let n = 2;
  while (id === ID_PADRAO || existentes.has(id)) id = `${base}-${n++}`;
  return id;
}

function ativar(id) {
  const dados = ler();
  if (id !== ID_PADRAO && !dados.layouts.some((l) => l.id === id)) {
    return { ok: false, mensagem: "Esse layout não existe mais." };
  }
  dados.ativo = id;
  const r = gravar(dados);
  return r.ok ? { ok: true, mensagem: "Layout ativo alterado." } : r;
}

// Duplicar é o único jeito de criar: um layout novo nasce cópia de um existente,
// que é o que faz sentido enquanto não há edição de grade.
function duplicar(idOrigem, nome) {
  const dados = ler();
  if (dados.layouts.length >= MAX_LAYOUTS) {
    return { ok: false, mensagem: `Limite de ${MAX_LAYOUTS} layouts atingido.` };
  }

  const origem =
    idOrigem === ID_PADRAO
      ? { nome: NOME_PADRAO, widgets: widgetsDoPadrao() }
      : dados.layouts.find((l) => l.id === idOrigem);

  if (!origem) return { ok: false, mensagem: "Esse layout não existe mais." };

  const nomeFinal = limparNome(nome) || `${origem.nome} (cópia)`;
  const id = novoId(nomeFinal, new Set(dados.layouts.map((l) => l.id)));

  dados.layouts.push({
    id,
    nome: nomeFinal,
    // O padrão não define tela; a cópia herda a moldura de quem tinha uma.
    ...(origem.tela ? { tela: { ...origem.tela } } : {}),
    widgets: JSON.parse(JSON.stringify(origem.widgets)),
  });
  dados.ativo = id;

  const r = gravar(dados);
  return r.ok ? { ok: true, mensagem: `Layout "${nomeFinal}" criado.`, id } : r;
}

function renomear(id, nome) {
  const nomeFinal = limparNome(nome);
  if (!nomeFinal) return { ok: false, mensagem: "O nome não pode ficar vazio." };
  if (id === ID_PADRAO) return { ok: false, mensagem: "O layout padrão não pode ser renomeado." };

  const dados = ler();
  const alvo = dados.layouts.find((l) => l.id === id);
  if (!alvo) return { ok: false, mensagem: "Esse layout não existe mais." };

  alvo.nome = nomeFinal;
  const r = gravar(dados);
  return r.ok ? { ok: true, mensagem: `Layout renomeado para "${nomeFinal}".` } : r;
}

function excluir(id) {
  if (id === ID_PADRAO) return { ok: false, mensagem: "O layout padrão não pode ser excluído." };

  const dados = ler();
  const antes = dados.layouts.length;
  dados.layouts = dados.layouts.filter((l) => l.id !== id);
  if (dados.layouts.length === antes) {
    return { ok: false, mensagem: "Esse layout não existe mais." };
  }
  // Excluir o que estava ativo volta para o padrão, nunca para "nenhum".
  if (dados.ativo === id) dados.ativo = ID_PADRAO;

  const r = gravar(dados);
  return r.ok ? { ok: true, mensagem: "Layout excluído." } : r;
}

// Grava o que o editor montou. Valida antes: o que chega aqui veio de uma janela,
// e o mesmo validador roda no app quando o layout desembarca no tablet.
function salvarWidgets(id, widgets, tela) {
  if (id === ID_PADRAO) {
    return { ok: false, mensagem: "O layout padrão não pode ser alterado. Duplique-o primeiro." };
  }

  const catalogo = carregar("catalogo-widgets.json");
  const { validarLayout } = carregar("validar-layout");
  const r = validarLayout(widgets, catalogo, { tela });

  if (!r.ok) {
    return { ok: false, mensagem: "O layout não tem nenhum widget válido; nada foi gravado." };
  }

  const dados = ler();
  const alvo = dados.layouts.find((l) => l.id === id);
  if (!alvo) return { ok: false, mensagem: "Esse layout não existe mais." };

  alvo.widgets = r.layout;
  if (r.tela) alvo.tela = r.tela;
  else delete alvo.tela;

  const gravou = gravar(dados);
  if (!gravou.ok) return gravou;

  return {
    ok: true,
    mensagem: `Layout "${alvo.nome}" salvo com ${r.layout.length} widgets.`,
    erros: r.erros,
  };
}

module.exports = {
  ID_PADRAO,
  salvarWidgets,
  estado,
  layoutAtivo,
  ativar,
  duplicar,
  renomear,
  excluir,
};
