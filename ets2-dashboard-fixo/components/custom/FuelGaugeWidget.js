import { StyleSheet, Text, View } from "react-native";

const FuelGaugeWidget = ({ telemetry, options, aoVivo = true }) => {
  const litros = telemetry?.combustivel;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{options.label || "COMBUSTÍVEL"}</Text>
      <Text style={styles.valueText}>
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
    color: "#8A8A8E",
    fontSize: 10,
  },

  valueText: {
    color: "#EAEAEA",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default FuelGaugeWidget;
