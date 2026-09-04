import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

const AlertIndicator = ({ telemetry, options }) => {
  const isActive = options.isActiveCheck(telemetry);
  const showLabel = options.showLabel !== false;

  const iconColor = isActive ? options.activeColor || "#FF3B30" : "#444";
  const labelColor = isActive ? "#EAEAEA" : "#444";

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
