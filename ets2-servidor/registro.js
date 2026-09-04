// ETS2_Servidor/registro.js
// Grava em arquivo tudo o que aparece no log da janela.
//
// Sem isto, "o app não conecta" é insolúvel à distância: a janela mostra o log
// da sessão atual, mas ele some quando o usuário fecha o programa — e o
// problema quase sempre já aconteceu antes de alguém pensar em olhar.
//
// Rotação simples: ao passar do tamanho máximo, servidor.log vira
// servidor.1.log, o .1 vira .2, e o mais antigo é descartado. Sem dependência
// externa, e sem crescer sem limite num PC que fica ligado o dia todo.

const fs = require("fs");
const path = require("path");

const TAMANHO_MAXIMO = 1024 * 1024; // 1 MB por arquivo
const ARQUIVOS_ANTIGOS = 3;

let pasta = null;
let arquivo = null;
let fluxo = null;
let bytesEscritos = 0;

function caminhoAntigo(n) {
  return path.join(pasta, `servidor.${n}.log`);
}

function abrir() {
  fluxo = fs.createWriteStream(arquivo, { flags: "a" });
  // Um erro de escrita não pode derrubar o servidor: o log é acessório.
  fluxo.on("error", () => {
    fluxo = null;
  });

  try {
    bytesEscritos = fs.statSync(arquivo).size;
  } catch {
    bytesEscritos = 0;
  }
}

function rotacionar() {
  try {
    fluxo?.end();
    fluxo = null;

    fs.rmSync(caminhoAntigo(ARQUIVOS_ANTIGOS), { force: true });
    for (let n = ARQUIVOS_ANTIGOS - 1; n >= 1; n--) {
      if (fs.existsSync(caminhoAntigo(n))) {
        fs.renameSync(caminhoAntigo(n), caminhoAntigo(n + 1));
      }
    }
    if (fs.existsSync(arquivo)) fs.renameSync(arquivo, caminhoAntigo(1));
  } catch {
    /* se a rotação falhar, seguimos escrevendo no arquivo atual */
  }

  abrir();
}

// Chamar uma vez, com app.getPath("userData"). Devolve a pasta dos logs.
function iniciar(userData, versao) {
  pasta = path.join(userData, "logs");
  arquivo = path.join(pasta, "servidor.log");

  try {
    fs.mkdirSync(pasta, { recursive: true });
    abrir();
    escrever(
      `===== ETS2 Servidor ${versao || ""} iniciado em ` +
        `${new Date().toLocaleString()} (${process.platform}, node ${process.versions.node}) =====`
    );
  } catch {
    fluxo = null; // sem permissão de escrita: o programa continua sem log
  }

  return pasta;
}

function escrever(mensagem) {
  if (!fluxo) return;

  const linha = `[${new Date().toISOString()}] ${mensagem}\n`;
  const bytes = Buffer.byteLength(linha);

  if (bytesEscritos + bytes > TAMANHO_MAXIMO) rotacionar();
  if (!fluxo) return;

  fluxo.write(linha);
  bytesEscritos += bytes;
}

const caminhoDaPasta = () => pasta;

module.exports = { iniciar, escrever, caminhoDaPasta };
