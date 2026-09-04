// ETS2_Servidor/testes/pareamento.js
// Exercita o handshake de pareamento de ponta a ponta, sem o jogo e sem o
// Electron: sobe o server.js de verdade numa porta livre, com robotjs e o addon
// nativo trocados por dublês, e checa cada caminho de aceite e de recusa.
//
//   npm test
//
// Sai com código 1 se qualquer caso falhar.

const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

// Pareamento num diretório temporário, para não encostar no do usuário.
process.env.ETS2_USER_DATA = path.join(os.tmpdir(), `ets2-teste-${Date.now()}`);
fs.mkdirSync(process.env.ETS2_USER_DATA, { recursive: true });

const PORTA_TESTE = 31998;
const VERBOSO = process.argv.includes("--verboso");

let codigoVisto = null;

// Finge ser o processo pai (main.js), de onde vem o código de pareamento.
process.send = (m) => {
  if (m.type === "codigo" && m.codigo) codigoVisto = m.codigo;
  if (VERBOSO && m.type === "log") console.log("   [servidor]", m.message.trim());
};

// robotjs e o addon nativo não participam do handshake.
const Module = require("module");
const requireOriginal = Module.prototype.require;
Module.prototype.require = function (nome) {
  if (nome === "robotjs") return { keyTap() {}, keyToggle() {} };
  if (nome.includes("leitor_memoria")) return { schemaVersion: 2, lerDados: () => null };
  if (nome === "./protocolo" || nome === "../protocolo") {
    // A porta 3000 costuma estar ocupada pelo servidor já instalado.
    return {
      ...requireOriginal.apply(this, arguments),
      TCP_PORT: PORTA_TESTE,
      DISCOVERY_PORT: 31997,
    };
  }
  return requireOriginal.apply(this, arguments);
};

const { montarProva, RECUSA } = require("../protocolo");
require("../server.js");

const WebSocket = require("ws");
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

// Abre uma conexão, responde ao challenge com o hello que o caso pedir e
// devolve a primeira resposta do servidor.
function conectar(montarHello) {
  return new Promise((pronto, falhou) => {
    const c = new WebSocket(`ws://127.0.0.1:${PORTA_TESTE}`);
    let desafio = null;
    const prazo = setTimeout(() => {
      c.close();
      falhou(new Error("servidor não respondeu em 5 s"));
    }, 5000);

    c.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.type === "challenge") {
        desafio = m;
        c.send(JSON.stringify(montarHello(m)));
        return;
      }
      clearTimeout(prazo);
      c.close();
      pronto({ ...m, desafio });
    });
    c.on("error", (e) => {
      clearTimeout(prazo);
      falhou(e);
    });
  });
}

// Abre uma conexão com um Origin específico, sem chegar ao handshake do
// pareamento — só interessa saber se o verifyClient deixou passar.
function conectarComOrigin(origin) {
  return new Promise((pronto) => {
    const c = new WebSocket(`ws://127.0.0.1:${PORTA_TESTE}`, { origin });
    c.on("open", () => {
      c.close();
      pronto({ aceito: true });
    });
    c.on("error", (e) => pronto({ aceito: false, erro: e.message }));
  });
}

const resultados = [];
function verificar(nome, condicao, detalhe) {
  resultados.push({ nome, ok: Boolean(condicao), detalhe });
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${nome}${detalhe ? `  (${detalhe})` : ""}`);
}

async function rodar() {
  const base = { type: "hello", deviceId: "tablet-1", nome: "SM-X510", protocolo: 3 };

  console.log("\nPareamento\n");

  const semCodigo = await conectar(() => base);
  verificar(
    "hello sem código, servidor sem dono, é recusado",
    semCodigo.type === "denied" && semCodigo.reason === RECUSA.PRECISA_CODIGO,
    semCodigo.reason
  );

  const codigoErrado = await conectar(() => ({ ...base, codigo: "000000" }));
  verificar(
    "código errado é recusado",
    codigoErrado.type === "denied" && codigoErrado.reason === RECUSA.CODIGO_INVALIDO,
    codigoErrado.reason
  );

  const pareou = await conectar(() => ({ ...base, codigo: codigoVisto }));
  const segredo = pareou.segredo;
  verificar(
    "código certo pareia e entrega o segredo",
    pareou.type === "welcome" && typeof segredo === "string" && segredo.length === 64,
    pareou.type
  );

  const reusarCodigo = await conectar(() => ({
    ...base,
    deviceId: "outro",
    codigo: codigoVisto,
  }));
  verificar(
    "o código não serve uma segunda vez",
    reusarCodigo.type === "denied",
    reusarCodigo.reason
  );

  const provaCerta = await conectar((d) => ({
    ...base,
    prova: sha(montarProva(d.nonce, segredo)),
  }));
  verificar(
    "reconexão com prova válida entra sem código",
    provaCerta.type === "welcome" && !provaCerta.segredo,
    provaCerta.type
  );

  const provaErrada = await conectar((d) => ({
    ...base,
    prova: sha(montarProva(d.nonce, "chute")),
  }));
  verificar(
    "mesmo deviceId sem o segredo é recusado",
    provaErrada.type === "denied" && provaErrada.reason === RECUSA.PROVA_INVALIDA,
    provaErrada.reason
  );

  const nonceVelho = pareou.desafio.nonce;
  const replay = await conectar(() => ({
    ...base,
    prova: sha(montarProva(nonceVelho, segredo)),
  }));
  verificar(
    "prova de um nonce antigo (replay) é recusada",
    replay.type === "denied" && replay.reason === RECUSA.PROVA_INVALIDA,
    replay.reason
  );

  const outroAparelho = await conectar(() => ({ ...base, deviceId: "invasor" }));
  verificar(
    "outro aparelho é recusado enquanto houver dono",
    outroAparelho.type === "denied" && outroAparelho.reason === RECUSA.JA_PAREADO,
    outroAparelho.reason
  );

  const appAntigo = await conectar(() => ({ ...base, protocolo: 2 }));
  verificar(
    "app da versão 2 do protocolo é recusado",
    appAntigo.type === "denied" && appAntigo.reason === RECUSA.PROTOCOLO,
    appAntigo.reason
  );

  const terceiro = await conectarComOrigin("https://site-qualquer.exemplo");
  verificar(
    "Origin de outro site (navegador) é recusado",
    terceiro.aceito === false,
    terceiro.erro
  );

  // O React Native manda Origin sempre, derivado da propria URL do WebSocket.
  // Recusar pela simples presenca do cabecalho barrava o tablet de verdade —
  // este caso existe para essa regressao nao voltar.
  const appNativo = await conectarComOrigin(`http://127.0.0.1:${PORTA_TESTE}`);
  verificar(
    "Origin do proprio servidor (React Native) e aceito",
    appNativo.aceito === true,
    appNativo.erro
  );

  const semOrigin = await conectarComOrigin(undefined);
  verificar(
    "conexao sem Origin e aceita",
    semOrigin.aceito === true,
    semOrigin.erro
  );

  const falhas = resultados.filter((r) => !r.ok);
  console.log(
    `\n${resultados.length - falhas.length}/${resultados.length} casos passaram.\n`
  );
  process.exit(falhas.length > 0 ? 1 : 0);
}

// Um instante para o server.listen subir.
setTimeout(() => {
  rodar().catch((e) => {
    console.error("\nErro no teste:", e.message);
    process.exit(1);
  });
}, 900);
