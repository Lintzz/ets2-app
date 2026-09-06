import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { avaliarAtivo } from "../../../compartilhado/avaliador";
import { resolverCores } from "../../../compartilhado/cores";

// aoVivo === false: jogo no menu ou pausado. O alerta apaga em vez de congelar no
// último estado, pelo mesmo motivo que os mostradores viram "--".
const AlertIndicator = ({ telemetry, options, aoVivo = true, cores }) => {
  const isActive = aoVivo && avaliarAtivo(options.ativoSe, telemetry);
  const showLabel = options.showLabel !== false;

  // `cores` chega pronto do DashboardWidget; o resolver aqui é só para o caso de
  // o componente ser usado solto.
  const paleta = cores || resolverCores(options.cores);
  const iconColor = isActive ? paleta.alerta : paleta.alertaApagado;
  const labelColor = isActive ? paleta.valor : paleta.alertaApagado;

  const renderIcon = () => {
    if (typeof options.iconName === "function") {
      const SvgComponent = options.iconName;
      return <SvgComponent width={24} height={24} fill={iconColor} />;
    }
    if (typeof options.iconName === "string") {
      return (
        <MaterialCommunityIcons
          name={options.iconName}
          size={24}
          color={iconColor}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderIcon()}
      {showLabel && (
        <Text style={[styles.label, { color: labelColor }]}>
          {options.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 8,
    fontWeight: "bold",
    marginTop: 1,
    textAlign: "center",
  },
});

export default AlertIndicator;
