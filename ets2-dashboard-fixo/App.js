import { StatusBar } from "expo-status-bar";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { NavigationBar } from "expo-navigation-bar";
import DashboardScreen from "./screens/DashboardScreen";

// As duas barras já nascem escondidas pelo styles.xml, gerado pelos plugins
// expo-status-bar e expo-navigation-bar declarados no app.json — é isso que
// evita o flash no arranque e a barra do sistema por cima do painel. Antes elas
// só eram escondidas por JS, depois do primeiro render, e com o edge-to-edge
// obrigatório do Android 15 voltavam a aparecer sobre o conteúdo.
//
// setVisibilityAsync/setBehaviorAsync não são mais usados: estão deprecados
// nesta versão do expo-navigation-bar (o substituto é NavigationBar.setHidden).
function esconderBarraDeNavegacao() {
  if (Platform.OS !== "android") return;
  try {
    NavigationBar.setHidden(true);
  } catch (e) {
    console.warn("Não foi possível esconder a barra de navegação:", e);
  }
}

export default function App() {
  useEffect(() => {
    esconderBarraDeNavegacao();

    // Depois de arrastar a borda para revelar a barra, ou de voltar de segundo
    // plano, o Android a deixa visível. Esconder de novo ao reativar.
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") esconderBarraDeNavegacao();
    });

    return () => inscricao.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {Platform.OS === "android" && <NavigationBar hidden />}
      <DashboardScreen />
      <StatusBar hidden />
    </GestureHandlerRootView>
  );
}
