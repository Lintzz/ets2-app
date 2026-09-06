// Paleta dos widgets.
//
// Estes valores estavam cravados em três lugares que precisavam concordar entre si
// sem nada garantindo: as constantes de `DashboardWidget.js`, o StyleSheet de
// `styles/dashboardStyles.js` e as custom properties do `<style>` de
// `dashboard.html` — este último com um comentário pedindo para não divergir.
// Agora são um arquivo só, e o pedido virou código.
//
// Toda cor de widget passa por `options.cores`, um objeto parcial: o que não for
// declarado cai no padrão daqui. É o que permite pintar um botão sem inventar
// campo novo, e é onde o editor vai escrever.
//
// CommonJS de propósito, como o avaliador: o Metro consome por `import`, o
// Electron por `require`, e não há build entre os dois.

const CORES_PADRAO = {
  // Botões (IconButton / CircularButton)
  icone: "#FFFFFF",
  iconeAtiva: "#00FF7F",
  fundo: "rgba(30, 32, 39, 0.8)",
  fundoAtiva: "rgba(0, 255, 127, 0.2)",
  borda: "#333333",
  bordaAtiva: "#00FF7F",

  // Textos: `rotulo` é a legenda pequena (do botão e do mostrador), `valor` é o
  // número grande do DataDisplay/FuelGauge e o texto do TextWidget.
  rotulo: "#8A8A8E",
  valor: "#EAEAEA",

  // Alertas
  alerta: "#FF3B30",
  alertaApagado: "#444444",
};

// Mescla rasa sobre o padrão. `options.cores` é sempre parcial.
function resolverCores(cores) {
  return cores ? { ...CORES_PADRAO, ...cores } : CORES_PADRAO;
}

module.exports = { CORES_PADRAO, resolverCores };
