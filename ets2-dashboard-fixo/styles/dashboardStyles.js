import { StyleSheet } from "react-native";

const colors = {
  background: "#0F1014",
  surface: "#1E2027",
  surfaceTransparent: "rgba(30, 32, 39, 0.8)",
  font: "#EAEAEA",
  fontSecondary: "#8A8A8E",
  accent: "#00FF7F",
};

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.font,
  },
  statusContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  statusText: { fontSize: 22, color: colors.accent, fontWeight: "bold" },
  iconButtonInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceTransparent,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  iconButtonActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(0, 255, 127, 0.2)",
  },
  iconButtonLabel: {
    color: colors.fontSecondary,
    fontSize: 10,
    position: "absolute",
    bottom: 5,
    fontWeight: "bold",
  },
  display: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  displayValue: { color: colors.font, fontSize: 18, fontWeight: "bold" },
  displayLabel: { color: colors.fontSecondary, fontSize: 10 },
  gridContainer: { flex: 1 },
  widgetWrapper: { position: "absolute", padding: 2 },
  widgetContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // --- Tela de conexão ---
  conexaoSubtexto: {
    color: colors.fontSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  conexaoManual: {
    marginTop: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  conexaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  conexaoInput: {
    backgroundColor: colors.surface,
    color: colors.font,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "#2E313A",
  },
  conexaoBotao: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  conexaoBotaoSecundario: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
  },
  conexaoBotaoInativo: { opacity: 0.5 },
  conexaoBotaoTexto: { color: "#0F1014", fontWeight: "bold", fontSize: 14 },
  conexaoErro: { color: "#FF6B6B", fontSize: 13, marginTop: 10 },
});
