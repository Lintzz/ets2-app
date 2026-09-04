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

module.exports = { garantirRegras, REGRAS, comandoManual };
