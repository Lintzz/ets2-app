import { StyleSheet, Text, View } from "react-native";
import { resolverCores } from "../../../compartilhado/cores";

const FuelGaugeWidget = ({ telemetry, options, aoVivo = true, cores }) => {
  const litros = telemetry?.combustivel;
  const paleta = cores || resolverCores(options.cores);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: paleta.rotulo }]}>
        {options.label || "COMBUSTÍVEL"}
      </Text>
      <Text style={[styles.valueText, { color: paleta.valor }]}>
        {aoVivo && typeof litros === "number" ? `${Math.round(litros)} L` : "--"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
  },
  
  label: {
    fontSize: 10,
  },

  valueText: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default FuelGaugeWidget;
