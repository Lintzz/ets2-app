// ETS2_Servidor/firewall.js
// Libera as portas do dashboard no Firewall do Windows.
//
// Este é o motivo mais comum de o app funcionar com o cabo (tethering) e não
// funcionar pelo Wi-Fi: quando o PC entra numa rede nova, o Windows classifica
// o perfil (Particular/Pública) e o Node só ganhou permissão para o perfil em
// que estava quando você clicou em "Permitir acesso" pela primeira vez.

const { execFile } = require("child_process");
const { DISCOVERY_PORT, TCP_PORT } = require("./protocolo");

const REGRAS = [
  { nome: "ETS2 Dashboard (TCP)", protocolo: "TCP", porta: TCP_PORT },
  { nome: "ETS2 Dashboard (UDP)", protocolo: "UDP", porta: DISCOVERY_PORT },
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
    `dir=in action=allow protocol=${regra.protocolo} localport=${regra.porta} profile=any`
  );
}

// Devolve { criadas: [...], jaExistiam: [...], falharam: [...] }.
async function garantirRegras() {
  const resultado = { criadas: [], jaExistiam: [], falharam: [] };

  if (process.platform !== "win32") return resultado;

  for (const regra of REGRAS) {
    const existe = await netsh([
      "advfirewall", "firewall", "show", "rule", `name=${regra.nome}`,
    ]);

    if (existe.ok) {
      resultado.jaExistiam.push(regra.nome);
      continue;
    }

    const criada = await netsh([
      "advfirewall", "firewall", "add", "rule",
      `name=${regra.nome}`,
      "dir=in",
      "action=allow",
      `protocol=${regra.protocolo}`,
      `localport=${regra.porta}`,
      "profile=any",
    ]);

    if (criada.ok) resultado.criadas.push(regra.nome);
    else resultado.falharam.push({ nome: regra.nome, comando: comandoManual(regra) });
  }

  return resultado;
}

module.exports = { garantirRegras, REGRAS, comandoManual };
