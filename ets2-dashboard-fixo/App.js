import { StatusBar } from "expo-status-bar";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import DashboardScreen from "./screens/DashboardScreen";

export default function App() {
  useEffect(() => {
    // Apenas para Android, pois iOS e outras plataformas já gerenciam isso de forma diferente
    if (Platform.OS === "android") {
      const hideNavigationBar = async () => {
        try {
          await NavigationBar.setBehaviorAsync("overlay-swipe");
          await NavigationBar.setVisibilityAsync("hidden");
        } catch (e) {
          console.error("Erro ao esconder a barra de navegação:", e);
        }
      };

      hideNavigationBar();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DashboardScreen />
      <StatusBar hidden />
    </GestureHandlerRootView>
  );
}
