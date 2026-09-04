// Dashlz servidor/atualizador.js
// Atualização automática do próprio servidor, via Squirrel.Windows.
//
// Sem isto, atualizar significa "baixe o instalador de novo e rode" — coisa que
// ninguém faz, e aí metade dos usuários fica numa versão com bug conhecido. O
// update-electron-app aponta para o update.electronjs.org, um serviço gratuito
// da Electron que lê as releases públicas do repositório do GitHub e serve o
// feed que o Squirrel espera. Não é preciso servidor próprio.
//
// Requisitos para funcionar de verdade:
//   1. o repositório precisa ser público;
//   2. cada release do servidor precisa levar os artefatos do `npm run make`
//      (RELEASES, *.nupkg e o .exe do Squirrel). No monorepo as releases do
//      servidor usam tag `vX.Y.Z` sem prefixo, justamente para o serviço as
//      reconhecer como semver — as do plugin e do app levam prefixo;
//   3. o app precisa estar instalado (não roda em `npm start`).
//
// Note que o Windows ainda vai mostrar o aviso do SmartScreen enquanto o
// instalador não for assinado — o auto-update não substitui a assinatura.

const { app } = require("electron");

const INTERVALO = "1 hour";

function iniciarAtualizacoes(registrarLog) {
  // Em desenvolvimento não há Squirrel: o pacote avisa e não faz nada, então
  // saímos antes para não poluir o log a cada `npm start`.
  if (!app.isPackaged) {
    registrarLog("Atualização automática: desligada em desenvolvimento.");
    return;
  }

  if (process.platform !== "win32") {
    registrarLog("Atualização automática: só implementada no Windows.");
    return;
  }

  try {
    const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: "Lintzz/ets2-app",
      },
      updateInterval: INTERVALO,
      // O log do pacote vai para a mesma janela e o mesmo arquivo que o resto.
      logger: {
        log: (...a) => registrarLog(`Atualização: ${a.join(" ")}`),
        info: (...a) => registrarLog(`Atualização: ${a.join(" ")}`),
        warn: (...a) => registrarLog(`Atualização: ${a.join(" ")}`),
        error: (...a) => registrarLog(`Atualização (erro): ${a.join(" ")}`),
      },
      // Pergunta antes de reiniciar: reiniciar sozinho no meio de uma viagem
      // derrubaria a conexão do tablet sem aviso.
      notifyUser: true,
    });

    registrarLog(`Atualização automática ligada (verifica a cada ${INTERVALO}).`);
  } catch (e) {
    registrarLog(`Atualização automática indisponível: ${e.message}`);
  }
}

module.exports = { iniciarAtualizacoes };
