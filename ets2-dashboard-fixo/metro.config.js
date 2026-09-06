// MeuDashboardApp/metro.config.js

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

// O catálogo de widgets e o layout padrão vivem em compartilhado/, na raiz do
// monorepo, para o app e a janela de espelho do servidor lerem o mesmo arquivo.
// Sem isto o Metro não enxerga nada fora da pasta do app.
config.watchFolders = [path.resolve(__dirname, "..", "compartilhado")];

module.exports = config;
