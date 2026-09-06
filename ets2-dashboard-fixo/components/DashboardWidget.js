// Dashlz app/components/DashboardWidget.js

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { avaliarAtivo, formatarValor } from "../../compartilhado/avaliador";
import { resolverCores } from "../../compartilhado/cores";
import { TAMANHO_CELULA } from "../../compartilhado/constantes";
import styles from "../styles/dashboardStyles";
import AlertIndicator from "./custom/AlertIndicator";
import FuelGaugeWidget from "./custom/FuelGaugeWidget";

// aoVivo === false: o jogo está no menu/pausado. O painel continua na tela e os
// botões continuam funcionando (é o único jeito de mandar ESC de volta para o
// jogo), mas os mostradores exibem "--" em vez de valores velhos ou zerados,
// para não parecer telemetria de verdade.
const WidgetContent = ({ config, telemetry, isBeingPressed, aoVivo }) => {
  const { type, options } = config;

  const isTelemetryActive = aoVivo && avaliarAtivo(options.ativoSe, telemetry);
  // options.cores é parcial; o que faltar vem do padrão de compartilhado/cores.js.
  const cores = resolverCores(options.cores);

  const isEffectivelyActive = isTelemetryActive || isBeingPressed;

  const widgetSize = {
    width: config.w * TAMANHO_CELULA,
    height: config.h * TAMANHO_CELULA,
  };
  const iconSize = Math.min(widgetSize.width, widgetSize.height) * 0.6;

  const renderIconOrImage = () => {
    const iconColor = isEffectivelyActive ? cores.iconeAtiva : cores.icone;
    if (typeof options.iconName === "function") {
      const SvgComponent = options.iconName;
      return (
        <SvgComponent width={iconSize} height={iconSize} fill={iconColor} />
      );
    }
    if (typeof options.iconName === "string") {
      return (
        <MaterialCommunityIcons
          name={options.iconName}
          size={iconSize}
          color={iconColor}
        />
      );
    }
    return null;
  };

  switch (type) {
    case "ColorArea":
      return (
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: cores.fundo,
            borderRadius: 12,
          }}
        />
      );
    case "TextWidget":
      return (
        <Text
          style={{
            fontSize: options.fontSize || 24,
            color: cores.valor,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {options.text || "Texto"}
        </Text>
      );
    case "CircularButton":
    case "IconButton":
      return (
        <View
          style={[
            styles.iconButtonInner,
            {
              backgroundColor: isEffectivelyActive ? cores.fundoAtiva : cores.fundo,
              borderColor: isEffectivelyActive ? cores.bordaAtiva : cores.borda,
            },
          ]}
        >
          {renderIconOrImage()}
        </View>
      );
    case "DataDisplay":
      const displayValue = aoVivo ? formatarValor(options.valor, telemetry) : "--";
      return (
        <View style={styles.display}>
          <Text style={[styles.displayLabel, { color: cores.rotulo }]}>
            {options.label}
          </Text>
          <Text style={[styles.displayValue, { color: cores.valor }]}>
            {displayValue}
          </Text>
        </View>
      );
    case "FuelGauge":
      return (
        <FuelGaugeWidget
          telemetry={telemetry}
          options={options}
          aoVivo={aoVivo}
          cores={cores}
        />
      );
    case "Alert":
      return (
        <AlertIndicator
          telemetry={telemetry}
          options={options}
          aoVivo={aoVivo}
          cores={cores}
        />
      );
    default:
      return <Text style={{ color: "red" }}>Tipo: {type}?</Text>;
  }
};

const DashboardWidget = ({
  config,
  telemetry,
  pressKey,
  holdKeyDown,
  holdKeyUp,
  aoVivo = true,
}) => {
  const [isBeingPressed, setIsBeingPressed] = useState(false);
  const panGesture = Gesture.Pan().enabled(false); // Gesto de arrastar desativado

  const handlePressIn = () => {
    setIsBeingPressed(true);
    if (config.options.isContinuous && config.options.key) {
      holdKeyDown(config.options.key);
    }
  };

  const handlePressOut = () => {
    setIsBeingPressed(false);
    if (config.options.isContinuous && config.options.key) {
      holdKeyUp(config.options.key);
    }
  };

  const handleSinglePress = () => {
    if (config.options.isContinuous || !config.options.key) return;
    pressKey(config.options.key);
  };

  const showLabel = config.options.showLabel !== false;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.widgetContainer}>
        <TouchableOpacity
          onPress={handleSinglePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.widgetContainer}
          activeOpacity={1.0}
        >
          <WidgetContent
            config={config}
            telemetry={telemetry}
            isBeingPressed={isBeingPressed}
            aoVivo={aoVivo}
          />
          {showLabel &&
            !!config.options.label &&
            (config.type === "IconButton" ||
              config.type === "CircularButton") && (
              <Text
                style={[
                  styles.iconButtonLabel,
                  { color: resolverCores(config.options.cores).rotulo },
                ]}
              >
                {config.options.label}
              </Text>
            )}
        </TouchableOpacity>
      </View>
    </GestureDetector>
  );
};

export default React.memo(DashboardWidget);
