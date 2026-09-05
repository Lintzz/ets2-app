// Dashlz servidor/firewall.js
// Libera as portas do dashboard no Firewall do Windows.
//
// Este é o motivo mais comum de o app funcionar com o cabo (tethering) e não
// funcionar pelo Wi-Fi: quando o PC entra numa rede nova, o Windows classifica
// o perfil (Particular/Pública) e o Node só ganhou permissão para o perfil em
// que estava quando você clicou em "Permitir acesso" pela primeira vez.
//
// As regras valem só para os perfis Particular e Domínio. Antes eram
// "profile=any", o que deixava a porta aberta também em rede Pública — a do
// hotel, do aeroporto, da cafeteria, onde qualquer um está do outro lado.
// Quem joga em rede marcada como Pública precisa mudar a rede para Particular
// nas configurações do Windows (que é o certo para a rede de casa).

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DISCOVERY_PORT, TCP_PORT } = require("./protocolo");

const PERFIS = "private,domain";

const REGRAS = [
  { nome: "Dashlz (TCP)", protocolo: "TCP", porta: TCP_PORT },
  { nome: "Dashlz (UDP)", protocolo: "UDP", porta: DISCOVERY_PORT },
];

const netsh = (args) =>
  new Promise((resolve) => {
    execFile("netsh", args, { windowsHide: true }, (erro, stdout, stderr) => {
      resolve({ ok: !erro, saida: (stdout || "") + (stderr || "") });
    });
  });

function comandoManual(regra) {
  return (
    `netsh advfirewall firewall add rule name="${regra.nome}" ` +
    `dir=in action=allow protocol=${regra.protocolo} localport=${regra.porta} profile=${PERFIS}`
  );
}

// Devolve { criadas: [...], jaExistiam: [...], corrigidas: [...], falharam: [...] }.
async function garantirRegras() {
  const resultado = { criadas: [], jaExistiam: [], corrigidas: [], falharam: [] };

  if (process.platform !== "win32") return resultado;

  for (const regra of REGRAS) {
    const existe = await netsh([
      "advfirewall", "firewall", "show", "rule", `name=${regra.nome}`,
    ]);

    if (existe.ok) {
      // Quem instalou uma versão anterior tem a regra com profile=any gravada.
      // Reescrever o perfil é idempotente e não depende do idioma do Windows
      // (ler o perfil da saída do "show rule" dependeria).
      const ajustada = await netsh([
        "advfirewall", "firewall", "set", "rule",
        `name=${regra.nome}`,
        "new",
        `profile=${PERFIS}`,
      ]);

      if (ajustada.ok) resultado.corrigidas.push(regra.nome);
      else resultado.jaExistiam.push(regra.nome);
      continue;
    }

    const criada = await netsh([
      "advfirewall", "firewall", "add", "rule",
      `name=${regra.nome}`,
      "dir=in",
      "action=allow",
      `protocol=${regra.protocolo}`,
      `localport=${regra.porta}`,
      `profile=${PERFIS}`,
    ]);

    if (criada.ok) resultado.criadas.push(regra.nome);
    else resultado.falharam.push({ nome: regra.nome, comando: comandoManual(regra) });
  }

  return resultado;
}

function comandoPerfil(nome) {
  return `netsh advfirewall firewall set rule name="${nome}" new profile=${PERFIS}`;
}

// Os comandos que ainda faltam aplicar, na forma em que o usuário rodaria a mão.
// Entram as regras que não puderam ser criadas e também as que existem mas cujo
// perfil não pôde ser reescrito ("jaExistiam"): numa instalação antiga elas ainda
// estão com profile=any, e sem admin o "set rule" falha do mesmo jeito.
function comandosDeCorrecao(resultado) {
  return [
    ...resultado.falharam.map((falha) => falha.comando),
    ...resultado.jaExistiam.map(comandoPerfil),
  ];
}

// Roda os netsh que faltaram numa única janela de UAC.
//
// O app fica como usuário comum: elevar o Electron inteiro colocaria o servidor
// WebSocket e o robotjs rodando como administrador, o que não é preciso e ainda
// faria o Windows deixar de entregar arrastar-e-soltar para a janela.
//
// Os comandos vão para um .cmd temporário em vez de irem como argumento: são
// dois netsh, e um arquivo só significa **um** UAC, não dois. Também evita
// escapar as aspas do name="..." através do PowerShell e do cmd.
async function aplicarComElevacao(comandos) {
  if (process.platform !== "win32") return { ok: false, recusado: false };
  if (comandos.length === 0) return { ok: true, recusado: false };

  const arquivo = path.join(
    os.tmpdir(),
    `dashlz-firewall-${process.pid}-${Date.now()}.cmd`
  );

  try {
    fs.writeFileSync(
      arquivo,
      ["@echo off", ...comandos, "exit /b 0", ""].join("\r\n"),
      "utf8"
    );
  } catch {
    return { ok: false, recusado: false };
  }

  // Cancelar o UAC faz o Start-Process lançar, então o "exit" nem chega a rodar
  // e o powershell sai com erro. Não dá para separar "recusado" de "falhou" pela
  // mensagem (ela depende do idioma do Windows), por isso quem chama reconfere o
  // estado real com estadoDasRegras() em vez de confiar neste retorno.
  const script =
    `$p = Start-Process -FilePath '${arquivo}' -Verb RunAs ` +
    `-WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode`;

  try {
    const saida = await new Promise((resolve) => {
      execFile(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true },
        (erro) => resolve({ ok: !erro })
      );
    });

    return { ok: saida.ok, recusado: !saida.ok };
  } finally {
    try {
      fs.unlinkSync(arquivo);
    } catch {}
  }
}

// garantirRegras(), e se faltar permissão pede admin uma vez e confere de novo.
// Devolve o resultado da primeira passada somado a { elevou, recusado } e com
// as regras que a elevação conseguiu criar movidas de "falharam" para "criadas".
// `aoPedirAdmin` avisa quem chamou logo antes de a janela do UAC aparecer.
async function garantirRegrasElevado(aoPedirAdmin) {
  const r = await garantirRegras();

  if (r.falharam.length === 0) return { ...r, elevou: false, recusado: false };

  if (aoPedirAdmin) aoPedirAdmin();
  const tentativa = await aplicarComElevacao(comandosDeCorrecao(r));

  // O que vale é o estado do firewall depois da tentativa, não o código de saída
  // do powershell.
  const agora = await estadoDasRegras();
  const criadas = r.falharam
    .filter((falha) => !agora.faltando.includes(falha.nome))
    .map((falha) => falha.nome);

  return {
    ...r,
    criadas: [...r.criadas, ...criadas],
    // O "set rule" do perfil não dá para reconferir sem depender do idioma da
    // saída do netsh, então aqui vale o código de saída do lote elevado.
    corrigidas: tentativa.ok ? [...r.corrigidas, ...r.jaExistiam] : r.corrigidas,
    jaExistiam: tentativa.ok ? [] : r.jaExistiam,
    falharam: r.falharam.filter((falha) => agora.faltando.includes(falha.nome)),
    elevou: true,
    recusado: agora.faltando.length > 0 && tentativa.recusado,
  };
}

// Só a detecção, sem tentar criar nada: para pintar o aviso na janela de status.
async function estadoDasRegras() {
  if (process.platform !== "win32") return { ok: true, faltando: [] };

  const faltando = [];

  for (const regra of REGRAS) {
    const existe = await netsh([
      "advfirewall", "firewall", "show", "rule", `name=${regra.nome}`,
    ]);
    if (!existe.ok) faltando.push(regra.nome);
  }

  return { ok: faltando.length === 0, faltando };
}

module.exports = {
  garantirRegras,
  garantirRegrasElevado,
  estadoDasRegras,
  REGRAS,
  comandoManual,
};
