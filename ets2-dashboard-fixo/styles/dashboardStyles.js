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
});
