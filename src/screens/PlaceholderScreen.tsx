import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export default function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  body: { color: colors.textMuted, marginTop: 6 },
});
