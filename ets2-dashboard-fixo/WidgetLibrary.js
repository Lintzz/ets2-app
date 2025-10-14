import { svgs } from "./SvgLibrary";

const WIDGETS = {
  // --- Decoração ---
  "color-area": {
    w: 6,
    h: 6,
    type: "ColorArea",
    options: { label: "Área Colorida", color: "#1E2027" },
  },
  "text-widget": {
    w: 6,
    h: 2,
    type: "TextWidget",
    options: {
      label: "Texto Decorativo",
      text: "Meu Texto",
      fontSize: 24,
      fontFamily: "",
      color: "#EAEAEA",
    },
  },

  // --- Motor & Condução ---
  "electric-btn": {
    w: 3,
    h: 3,
    type: "CircularButton",
    options: {
      iconName: "flash",
      label: "Energia",
      key: "f10",
      isActiveCheck: (t) => t.electricoLigado,
    },
  },
  "engine-btn": {
    w: 3,
    h: 3,
    type: "CircularButton",
    options: {
      iconName: "engine",
      label: "Motor",
      key: "e",
      isActiveCheck: (t) => t.motorLigado,
    },
  },
  "transmission-mode-btn": {
    w: 3,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-shift-pattern",
      label: "Câmbio M/A",
      key: "a",
    },
  },
  "parking-brake-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-brake-parking",
      label: "Freio de Mão",
      key: "space",
      isActiveCheck: (t) => t.freioEstacionamento,
    },
  },
  "diff-lock-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.Diferencial,
      label: "Diferencial",
      key: "v",
      isActiveCheck: (t) => t.bloqueioDiferencial,
    },
  },
  "lift-truck-axle": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.EixoCavalo,
      label: "Eixo Cavalo",
      key: "u",
      isActiveCheck: (t) => t.eixoCaminhaoLevantado,
    },
  },
  "lift-trailer-axle": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.EixoCarreta,
      label: "Eixo Carreta",
      key: "left",
      isActiveCheck: (t) => t.eixoReboqueLevantado,
    },
  },
  "trailer-attach": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.Engate,
      label: "Engate",
      key: "t",
      isActiveCheck: (t) => t.reboqueConectado,
    },
  },

  // --- Freios (Motor & Retarder) ---
  "engine-brake-toggle": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "engine-off-outline",
      label: "Freio Motor",
      key: "b",
      isActiveCheck: (t) => t.freioMotor,
    },
  },
  "engine-brake-increase": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-up",
      label: "Freio Motor +",
      key: "up",
      isContinuous: true,
    },
  },
  "engine-brake-decrease": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-down",
      label: "Freio Motor -",
      key: "down",
      isContinuous: true,
    },
  },
  "retarder-toggle": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-brake-retarder",
      label: "Retarder M/A",
      key: "right",
    },
  },
  "retarder-increase": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-up",
      label: "Retarder +",
      key: ";",
      isContinuous: true,
    },
  },
  "retarder-decrease": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-down",
      label: "Retarder -",
      key: "'",
      isContinuous: true,
    },
  },

  // --- Cruise Control ---
  "cruise-control-toggle": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-cruise-control",
      label: "Ativar CC",
      key: "c",
      isActiveCheck: (t) => t.velocidadeCruzeiroKmh > 0,
    },
  },
  "cruise-control-increase": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-up",
      label: "CC +",
      key: "w",
      isContinuous: true,
    },
  },
  "cruise-control-decrease": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-down",
      label: "CC -",
      key: "s",
      isContinuous: true,
    },
  },

  // --- Luzes ---
  "lights-parking": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-light-dimmed",
      label: "Lanterna",
      key: "l",
      isActiveCheck: (t) => t.luzesEstacionamento,
    },
  },
  "lights-low": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-light-fog",
      label: "Farol Baixo",
      key: "l",
      isActiveCheck: (t) => t.farolBaixo,
    },
  },
  "lights-high": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "car-light-high",
      label: "Farol Alto",
      key: "k",
      isActiveCheck: (t) => t.farolAlto,
    },
  },
  "beacon-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "alarm-light",
      label: "Giroflex",
      key: "o",
      isActiveCheck: (t) => t.luzGiroflex,
    },
  },
  "hazard-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "hazard-lights",
      label: "Pisca Alerta",
      key: "f",
      isActiveCheck: (t) => t.piscaAlerta,
    },
  },

  // --- Cabine & Câmeras ---
  "camera-1": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { iconName: svgs.Cam1, label: "Câmera 1", key: "1" },
  },
  "camera-2": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { iconName: svgs.Cam2, label: "Câmera 2", key: "2" },
  },
  "camera-3": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { iconName: svgs.Cam3, label: "Câmera 3", key: "3" },
  },
  "window-left-up": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-up",
      label: "Vidro Esq. +",
      key: "end",
      isContinuous: true,
    },
  },
  "window-left-down": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-down",
      label: "Vidro Esq. -",
      key: "home",
      isContinuous: true,
    },
  },
  "window-right-up": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-up",
      label: "Vidro Dir. +",
      key: "delete",
      isContinuous: true,
    },
  },
  "window-right-down": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: "chevron-down",
      label: "Vidro Dir. -",
      key: "insert",
      isContinuous: true,
    },
  },
  "wipers-increase": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { iconName: "wiper", label: "Limpador +", key: "p" },
  },
  "wipers-decrease": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { iconName: "wiper", label: "Limpador -", key: "q" },
  },
  "susp-front-up": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.SuspDianteiraMais,
      label: "Susp. Diant+",
      key: "numpad_1",
      isContinuous: true,
    },
  },
  "susp-front-down": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.SuspDianteiraMenos,
      label: "Susp. Diant-",
      key: "numpad_2",
      isContinuous: true,
    },
  },
  "susp-rear-up": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.SuspTraseiraMais,
      label: "Susp. Tras+",
      key: "numpad_3",
      isContinuous: true,
    },
  },
  "susp-rear-down": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.SuspTraseiraMenos,
      label: "Susp. Tras-",
      key: "numpad_4",
      isContinuous: true,
    },
  },
  "susp-reset": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      iconName: svgs.SuspPadrao,
      label: "Reset Susp.",
      key: "numpad_0",
    },
  },

  // --- UI & Sistema ---
  "advisor-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "map-marker",
      label: "Advisor",
      key: "f5",
    },
  },
  "jobs-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "briefcase",
      label: "Trabalhos",
      key: "f6",
    },
  },
  "settings-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "cog",
      label: "Settings",
      key: "f7",
    },
  },
  "modes-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "view-grid",
      label: "Modes",
      key: "f3",
    },
  },
  "config-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: { showLabel: false, iconName: "tune", label: "Config", key: "f4" },
  },
  "mirrors-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "mirror-rectangle",
      label: "Retrovisores",
      key: "f2",
    },
  },
  "map-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "map-legend",
      label: "Mapa",
      key: "m",
    },
  },
  "dashboard-panel-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "view-dashboard",
      label: "Painel",
      key: "i",
    },
  },
  "garage-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "garage",
      label: "Garagem",
      key: "g",
    },
  },
  "windows-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "microsoft-windows",
      label: "Windows",
      key: "command",
    },
  },
  "esc-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "keyboard-esc",
      label: "ESC",
      key: "escape",
    },
  },
  "enter-btn": {
    w: 2,
    h: 2,
    type: "IconButton",
    options: {
      showLabel: false,
      iconName: "keyboard-return",
      label: "Enter",
      key: "enter",
    },
  },

  // --- Mostradores ---
  "speed-display": {
    w: 3,
    h: 2,
    type: "DataDisplay",
    options: { label: "KM/H", value: (t) => (t.velocidadeKmh ?? 0).toFixed(0) },
  },
  "gear-display": {
    w: 3,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "MARCHA",
      value: (t) => {
        const g = t.marcha ?? 0;
        return g === 0 ? "N" : g < 0 ? `R${Math.abs(g)}` : `${g}`;
      },
    },
  },
  "fuel-gauge": {
    w: 4,
    h: 2,
    type: "FuelGauge",
    options: { label: "COMBUSTÍVEL" },
  },
  "job-distance": {
    w: 4,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "DISTÂNCIA VIAGEM",
      value: (t) => `${((t.navDistancia ?? 0) / 1000).toFixed(1)} km`,
    },
  },
  "damage-truck-display": {
    w: 4,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "DANO CAMINHÃO",
      value: (t) => `${((t.danoMotor ?? 0) * 100).toFixed(0)}%`,
    },
  },
  "damage-trailer-display": {
    w: 4,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "DANO CARRETA",
      value: (t) => `${((t.danoReboque ?? 0) * 100).toFixed(0)}%`,
    },
  },
  "damage-cargo-display": {
    w: 4,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "DANO CARGA",
      value: (t) => `${((t.danoCarga ?? 0) * 100).toFixed(0)}%`,
    },
  },
  "cruise-control-speed-display": {
    w: 3,
    h: 2,
    type: "DataDisplay",
    options: {
      label: "VEL. CRUZEIRO",
      value: (t) => (t.velocidadeCruzeiroKmh ?? 0).toFixed(0),
    },
  },
  "retarder-display": {
    w: 3,
    h: 2,
    type: "DataDisplay",
    options: { label: "NÍVEL RETARDER", value: (t) => t.retarder ?? 0 },
  },

  // --- Alertas & Indicadores ---
  "status-turn-left": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "arrow-left-bold",
      activeColor: "#FFD700",
      label: "Seta Esq.",
      isActiveCheck: (t) => t.piscaEsquerdoOn,
    },
  },
  "status-turn-right": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "arrow-right-bold",
      activeColor: "#FFD700",
      label: "Seta Dir.",
      isActiveCheck: (t) => t.piscaDireitoOn,
    },
  },
  "status-beacon": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "alarm-light",
      activeColor: "#FFA500",
      label: "Giroflex",
      isActiveCheck: (t) => t.luzGiroflex,
    },
  },
  "status-parking-brake": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "car-brake-parking",
      activeColor: "#DC3545",
      label: "Freio Mão",
      isActiveCheck: (t) => t.freioEstacionamento,
    },
  },
  "status-hazard": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "hazard-lights",
      activeColor: "#DC3545",
      label: "Pisca Alerta",
      isActiveCheck: (t) => t.piscaAlerta,
    },
  },
  "status-lights": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "car-light-dimmed",
      activeColor: "#28A745",
      label: "Luzes",
      isActiveCheck: (t) =>
        t.luzesEstacionamento || t.farolBaixo || t.farolAlto,
    },
  },
  "status-high-beam": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "car-light-high",
      activeColor: "#007BFF",
      label: "Farol Alto",
      isActiveCheck: (t) => t.farolAlto,
    },
  },
  "status-retarder": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "car-brake-retarder",
      activeColor: "#17A2B8",
      label: "Retarder",
      isActiveCheck: (t) => (t.retarder ?? 0) > 0,
    },
  },
  "status-engine-brake": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "engine-off-outline",
      activeColor: "#17A2B8",
      label: "Freio Motor",
      isActiveCheck: (t) => t.freioMotor,
    },
  },
  "warning-fuel": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "gas-station-off",
      activeColor: "#DC3545",
      label: "Combustível",
      isActiveCheck: (t) => t.avisoCombustivel,
    },
  },
  "warning-oil": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "oil-level",
      activeColor: "#DC3545",
      label: "Óleo",
      isActiveCheck: (t) => t.avisoPressaoOleo,
    },
  },
  "warning-water": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "coolant-temperature",
      activeColor: "#DC3545",
      label: "Água",
      isActiveCheck: (t) => t.avisoTempAgua,
    },
  },
  "warning-battery": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "battery-alert-variant-outline",
      activeColor: "#DC3545",
      label: "Bateria",
      isActiveCheck: (t) => t.avisoVoltagemBateria,
    },
  },
  "warning-air": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "air-filter",
      activeColor: "#DC3545",
      label: "Pressão Ar",
      isActiveCheck: (t) => t.avisoPressaoAr,
    },
  },
  "status-cruise": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "car-cruise-control",
      activeColor: "#28A745",
      label: "Piloto Auto",
      isActiveCheck: (t) => t.velocidadeCruzeiroKmh > 0,
    },
  },
  "status-diff-lock": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: "axis-z-rotate-counterclockwise",
      activeColor: "#FFC107",
      label: "Diferencial",
      isActiveCheck: (t) => t.bloqueioDiferencial,
    },
  },
  "status-lift-truck": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: svgs.EixoCavalo,
      activeColor: "#6F42C1",
      label: "Eixo Cavalo",
      isActiveCheck: (t) => t.eixoCaminhaoLevantado,
    },
  },
  "status-lift-trailer": {
    w: 1,
    h: 1,
    type: "Alert",
    options: {
      showLabel: false,
      iconName: svgs.EixoCarreta,
      activeColor: "#6F42C1",
      label: "Eixo Carreta",
      isActiveCheck: (t) => t.eixoReboqueLevantado,
    },
  },
};

export const WIDGET_LIBRARY = WIDGETS;
