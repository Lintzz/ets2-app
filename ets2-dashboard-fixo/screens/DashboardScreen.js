import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import DashboardWidget from "../components/DashboardWidget";
import { useTelemetry } from "../hooks/useTelemetry";
import styles from "../styles/dashboardStyles";
import { WIDGET_LIBRARY } from "../WidgetLibrary";

const GRID_CELL_SIZE = 35;

// // =================== COMPONENTE PARA VISUALIZAR A GRADE ===================
// const GridOverlay = () => {
//   const horizontalLines = [];
//   const verticalLines = [];

//   // Ajuste o número de linhas para se adequar à sua tela
//   const numberOfCellsX = 40; // Exemplo: 40 células na horizontal
//   const numberOfCellsY = 25; // Exemplo: 25 células na vertical

//   for (let i = 0; i < numberOfCellsY; i++) {
//     horizontalLines.push(
//       <View
//         key={`h-${i}`}
//         style={{
//           position: "absolute",
//           top: i * GRID_CELL_SIZE,
//           left: 0,
//           right: 0,
//           height: 1,
//           backgroundColor: "rgba(255, 0, 0, 0.5)", // Cor vermelha semitransparente
//         }}
//       />
//     );
//   }

//   for (let i = 0; i < numberOfCellsX; i++) {
//     verticalLines.push(
//       <View
//         key={`v-${i}`}
//         style={{
//           position: "absolute",
//           top: 0,
//           bottom: 0,
//           left: i * GRID_CELL_SIZE,
//           width: 1,
//           backgroundColor: "rgba(255, 0, 0, 0.5)", // Cor vermelha semitransparente
//         }}
//       />
//     );
//   }

//   return (
//     <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
//       {horizontalLines}
//       {verticalLines}
//     </View>
//   );
// };
// // ===========================================================================

const INITIAL_WIDGETS = [
  {
    id: "color-area-1759883150965",
    widgetKey: "color-area",
    x: 12,
    y: 2,
    w: 13,
    h: 11,
  },
  {
    id: "lights-parking-1759879352583",
    widgetKey: "lights-parking",
    x: 1,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "lights-low-1759879352583",
    widgetKey: "lights-low",
    x: 4,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "lights-high-1759879399226",
    widgetKey: "lights-high",
    x: 7,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "beacon-btn-1759880092789",
    widgetKey: "beacon-btn",
    x: 10,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "hazard-btn-1759880109728",
    widgetKey: "hazard-btn",
    x: 13,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "engine-brake-toggle-1759880167554",
    widgetKey: "engine-brake-toggle",
    x: 1,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "engine-brake-increase-1759880167554",
    widgetKey: "engine-brake-increase",
    x: 1,
    y: 10,
    w: 3,
    h: 3,
  },
  {
    id: "engine-brake-decrease-1759880167554",
    widgetKey: "engine-brake-decrease",
    x: 1,
    y: 13,
    w: 3,
    h: 3,
  },
  {
    id: "retarder-toggle-1759880219421",
    widgetKey: "retarder-toggle",
    x: 4,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "retarder-increase-1759880219421",
    widgetKey: "retarder-increase",
    x: 4,
    y: 10,
    w: 3,
    h: 3,
  },
  {
    id: "retarder-decrease-1759880219421",
    widgetKey: "retarder-decrease",
    x: 4,
    y: 13,
    w: 3,
    h: 3,
  },
  {
    id: "cruise-control-toggle-1759880313997",
    widgetKey: "cruise-control-toggle",
    x: 7,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "cruise-control-increase-1759880313997",
    widgetKey: "cruise-control-increase",
    x: 7,
    y: 10,
    w: 3,
    h: 3,
  },
  {
    id: "cruise-control-decrease-1759880313997",
    widgetKey: "cruise-control-decrease",
    x: 7,
    y: 13,
    w: 3,
    h: 3,
  },
  {
    id: "cruise-control-speed-display-1759880313997",
    widgetKey: "cruise-control-speed-display",
    x: 7,
    y: 5,
    w: 3,
    h: 2,
  },
  {
    id: "electric-btn-1759880383924",
    widgetKey: "electric-btn",
    x: 1,
    y: 1,
    w: 4,
    h: 4,
  },
  {
    id: "engine-btn-1759880400095",
    widgetKey: "engine-btn",
    x: 6,
    y: 1,
    w: 4,
    h: 4,
  },
  {
    id: "fuel-gauge-1759880428169",
    widgetKey: "fuel-gauge",
    x: 22,
    y: 13,
    w: 3,
    h: 2,
  },
  {
    id: "transmission-mode-btn-1759880492389",
    widgetKey: "transmission-mode-btn",
    x: 17,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "parking-brake-btn-1759880530723",
    widgetKey: "parking-brake-btn",
    x: 20,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "diff-lock-btn-1759880547389",
    widgetKey: "diff-lock-btn",
    x: 24,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "lift-trailer-axle-1759880558974",
    widgetKey: "lift-trailer-axle",
    x: 30,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "lift-truck-axle-1759880581658",
    widgetKey: "lift-truck-axle",
    x: 27,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "trailer-attach-1759880600105",
    widgetKey: "trailer-attach",
    x: 33,
    y: 17,
    w: 3,
    h: 6,
  },
  {
    id: "susp-front-up-1759880746196",
    widgetKey: "susp-front-up",
    x: 27,
    y: 10,
    w: 3,
    h: 3,
  },
  {
    id: "susp-front-down-1759880746196",
    widgetKey: "susp-front-down",
    x: 27,
    y: 13,
    w: 3,
    h: 3,
  },
  {
    id: "susp-rear-up-1759880787222",
    widgetKey: "susp-rear-up",
    x: 30,
    y: 10,
    w: 3,
    h: 3,
  },
  {
    id: "susp-rear-down-1759880787222",
    widgetKey: "susp-rear-down",
    x: 30,
    y: 13,
    w: 3,
    h: 3,
  },
  {
    id: "susp-reset-1759880820540",
    widgetKey: "susp-reset",
    x: 33,
    y: 10,
    w: 3,
    h: 6,
  },
  {
    id: "window-left-up-1759880850325",
    widgetKey: "window-left-up",
    x: 30,
    y: 4,
    w: 3,
    h: 3,
  },
  {
    id: "window-left-down-1759880850325",
    widgetKey: "window-left-down",
    x: 30,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "window-right-up-1759880865204",
    widgetKey: "window-right-up",
    x: 33,
    y: 4,
    w: 3,
    h: 3,
  },
  {
    id: "window-right-down-1759880865204",
    widgetKey: "window-right-down",
    x: 33,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "wipers-increase-1759880874619",
    widgetKey: "wipers-increase",
    x: 27,
    y: 4,
    w: 3,
    h: 3,
  },
  {
    id: "wipers-decrease-1759880874619",
    widgetKey: "wipers-decrease",
    x: 27,
    y: 7,
    w: 3,
    h: 3,
  },
  {
    id: "camera-1-1759880885778",
    widgetKey: "camera-1",
    x: 27,
    y: 1,
    w: 3,
    h: 3,
  },
  {
    id: "camera-2-1759880892400",
    widgetKey: "camera-2",
    x: 30,
    y: 1,
    w: 3,
    h: 3,
  },
  {
    id: "camera-3-1759880899235",
    widgetKey: "camera-3",
    x: 33,
    y: 1,
    w: 3,
    h: 3,
  },
  {
    id: "advisor-btn-1759881113205",
    widgetKey: "advisor-btn",
    x: 13,
    y: 3,
    w: 2,
    h: 2,
  },
  {
    id: "jobs-btn-1759881126794",
    widgetKey: "jobs-btn",
    x: 16,
    y: 3,
    w: 2,
    h: 2,
  },
  {
    id: "settings-btn-1759881133540",
    widgetKey: "settings-btn",
    x: 19,
    y: 3,
    w: 2,
    h: 2,
  },
  {
    id: "modes-btn-1759881140084",
    widgetKey: "modes-btn",
    x: 22,
    y: 3,
    w: 2,
    h: 2,
  },
  {
    id: "config-btn-1759881147602",
    widgetKey: "config-btn",
    x: 13,
    y: 6,
    w: 2,
    h: 2,
  },
  {
    id: "mirrors-btn-1759881158016",
    widgetKey: "mirrors-btn",
    x: 16,
    y: 6,
    w: 2,
    h: 2,
  },
  {
    id: "map-btn-1759881165326",
    widgetKey: "map-btn",
    x: 19,
    y: 6,
    w: 2,
    h: 2,
  },
  {
    id: "dashboard-panel-btn-1759881172824",
    widgetKey: "dashboard-panel-btn",
    x: 22,
    y: 6,
    w: 2,
    h: 2,
  },
  {
    id: "garage-btn-1759881180460",
    widgetKey: "garage-btn",
    x: 13,
    y: 9,
    w: 2,
    h: 2,
  },
  {
    id: "esc-btn-1759881186796",
    widgetKey: "esc-btn",
    x: 19,
    y: 9,
    w: 2,
    h: 2,
  },
  {
    id: "windows-btn-1759881195080",
    widgetKey: "windows-btn",
    x: 16,
    y: 9,
    w: 2,
    h: 2,
  },
  {
    id: "enter-btn-1759881204400",
    widgetKey: "enter-btn",
    x: 22,
    y: 9,
    w: 2,
    h: 2,
  },
  {
    id: "gear-display-1759881228063",
    widgetKey: "gear-display",
    x: 12,
    y: 13,
    w: 3,
    h: 2,
  },
  {
    id: "speed-display-1759881243606",
    widgetKey: "speed-display",
    x: 15,
    y: 13,
    w: 3,
    h: 2,
  },
  {
    id: "job-distance-1759881262371",
    widgetKey: "job-distance",
    x: 18,
    y: 13,
    w: 4,
    h: 2,
  },
  {
    id: "damage-truck-display-1759881274846",
    widgetKey: "damage-truck-display",
    x: 12,
    y: 15,
    w: 4,
    h: 1,
  },
  {
    id: "damage-trailer-display-1759881286584",
    widgetKey: "damage-trailer-display",
    x: 16,
    y: 15,
    w: 5,
    h: 1,
  },
  {
    id: "damage-cargo-display-1759881296156",
    widgetKey: "damage-cargo-display",
    x: 21,
    y: 15,
    w: 4,
    h: 1,
  },
  {
    id: "status-turn-right-1759881394432",
    widgetKey: "status-turn-right",
    x: 25,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "warning-air-1759881436905",
    widgetKey: "warning-air",
    x: 13,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "warning-oil-1759881465791",
    widgetKey: "warning-oil",
    x: 15,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "warning-water-1759881482049",
    widgetKey: "warning-water",
    x: 17,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "warning-battery-1759881494946",
    widgetKey: "warning-battery",
    x: 19,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "warning-fuel-1759881508947",
    widgetKey: "warning-fuel",
    x: 21,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "status-retarder-1759881544942",
    widgetKey: "status-retarder",
    x: 23,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "status-beacon-1759881561073",
    widgetKey: "status-beacon",
    x: 11,
    y: 3,
    w: 1,
    h: 1,
  },
  {
    id: "status-parking-brake-1759881574865",
    widgetKey: "status-parking-brake",
    x: 11,
    y: 5,
    w: 1,
    h: 1,
  },
  {
    id: "status-hazard-1759881591244",
    widgetKey: "status-hazard",
    x: 11,
    y: 7,
    w: 1,
    h: 1,
  },
  {
    id: "status-lights-1759881606416",
    widgetKey: "status-lights",
    x: 11,
    y: 9,
    w: 1,
    h: 1,
  },
  {
    id: "status-high-beam-1759881629093",
    widgetKey: "status-high-beam",
    x: 11,
    y: 11,
    w: 1,
    h: 1,
  },
  {
    id: "status-engine-brake-1759881644608",
    widgetKey: "status-engine-brake",
    x: 25,
    y: 3,
    w: 1,
    h: 1,
  },
  {
    id: "status-cruise-1759881655749",
    widgetKey: "status-cruise",
    x: 25,
    y: 5,
    w: 1,
    h: 1,
  },
  {
    id: "status-diff-lock-1759881674519",
    widgetKey: "status-diff-lock",
    x: 25,
    y: 7,
    w: 1,
    h: 1,
  },
  {
    id: "status-lift-truck-1759881688671",
    widgetKey: "status-lift-truck",
    x: 25,
    y: 9,
    w: 1,
    h: 1,
  },
  {
    id: "status-lift-trailer-1759881702885",
    widgetKey: "status-lift-trailer",
    x: 25,
    y: 11,
    w: 1,
    h: 1,
  },
  {
    id: "text-widget-1759883080589",
    widgetKey: "text-widget",
    x: 12,
    y: 5,
    w: 4,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Navegação",
      fontSize: 11,
    },
  },
  {
    id: "status-turn-left-1759884134487",
    widgetKey: "status-turn-left",
    x: 11,
    y: 1,
    w: 1,
    h: 1,
  },
  {
    id: "text-widget-1759945819350",
    widgetKey: "text-widget",
    x: 16,
    y: 5,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Trabalho",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759945889361",
    widgetKey: "text-widget",
    x: 18,
    y: 5,
    w: 4,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Assistência",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759945921414",
    widgetKey: "text-widget",
    x: 22,
    y: 5,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Modos",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759945955690",
    widgetKey: "text-widget",
    x: 13,
    y: 8,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Ajustes",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759945984182",
    widgetKey: "text-widget",
    x: 16,
    y: 8,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Retrovisor",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946021184",
    widgetKey: "text-widget",
    x: 22,
    y: 8,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Painel",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946054525",
    widgetKey: "text-widget",
    x: 19,
    y: 8,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Mapa",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946080368",
    widgetKey: "text-widget",
    x: 13,
    y: 11,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Garagem",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946109316",
    widgetKey: "text-widget",
    x: 16,
    y: 11,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Win",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946129604",
    widgetKey: "text-widget",
    x: 19,
    y: 11,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Esc",
      fontSize: 11,
    },
  },
  {
    id: "text-widget-1759946150016",
    widgetKey: "text-widget",
    x: 22,
    y: 11,
    w: 2,
    h: 1,
    options: {
      showLabel: true,
      color: "#EAEAEA",
      text: "Enter",
      fontSize: 11,
    },
  },
  {
    id: "retarder-display-1760044608765",
    widgetKey: "retarder-display",
    x: 4,
    y: 5,
    w: 3,
    h: 2,
  },
];

const rehydrateLayout = (layout) => {
  return layout
    .map((savedWidget) => {
      const libraryConfig = WIDGET_LIBRARY[savedWidget.widgetKey];
      if (!libraryConfig) return null;
      return {
        ...libraryConfig,
        ...savedWidget,
        options: { ...libraryConfig.options, ...savedWidget.options },
      };
    })
    .filter(Boolean);
};

export default function DashboardScreen() {
  const [widgets, setWidgets] = useState([]);
  const { isConnected, telemetry, pressKey, holdKeyDown, holdKeyUp } =
    useTelemetry();

  useEffect(() => {
    setWidgets(rehydrateLayout(INITIAL_WIDGETS));
  }, []);

  if (!telemetry) {
    return (
      <View style={styles.statusContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#FFA500" />
        <Text style={styles.statusText}>
          {!isConnected ? "A procurar servidor..." : "Aguardando Jogo..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.gridContainer}>
        {widgets.map((widget, index) => (
          <View
            key={widget.id}
            style={[
              styles.widgetWrapper,
              {
                left: widget.x * GRID_CELL_SIZE,
                top: widget.y * GRID_CELL_SIZE,
                width: widget.w * GRID_CELL_SIZE,
                height: widget.h * GRID_CELL_SIZE,
                zIndex: index,
              },
            ]}
          >
            <DashboardWidget
              config={widget}
              telemetry={telemetry}
              pressKey={pressKey}
              holdKeyDown={holdKeyDown}
              holdKeyUp={holdKeyUp}
            />
          </View>
        ))}
        {/* Adicione o componente de grade aqui
        <GridOverlay /> */}
      </View>
    </View>
  );
}
