import { StyleSheet, Text, View } from "react-native";

const FuelGaugeWidget = ({ telemetry, options }) => {
  const fuelPercentage =
    (telemetry.combustivel / telemetry.capacidadeCombustivel) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{options.label || "COMBUSTÍVEL"}</Text>
      <Text style={styles.valueText}>
        {`${Math.round(telemetry.combustivel)} L`}
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
