// Lado de uma célula do grid, em pixels. É a unidade de x/y/w/h de todo layout.
// Estava duplicado entre DashboardScreen.js e DashboardWidget.js; a janela de
// espelho do servidor precisa do mesmo número para desenhar na mesma escala.
const TAMANHO_CELULA = 35;

module.exports = { TAMANHO_CELULA };
