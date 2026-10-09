import React from "react";
import { Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ImageBackground, View, ImageSourcePropType } from "react-native";
import { colors } from "../theme";
import MggBanner from "../components/MggBanner";
import { useGold } from "../gold/GoldContext";

export type HomeTarget = "stock" | "gold" | "currencies" | "crypto";

const CARDS: { key: HomeTarget; title: string; image: ImageSourcePropType }[] = [
  { key: "stock", title: "Stock", image: require("../../assets/home/stock.jpg") },
  { key: "gold", title: "Gold", image: require("../../assets/home/gold.jpg") },
  { key: "currencies", title: "Currencies", image: require("../../assets/home/currencies.jpg") },
  { key: "crypto", title: "Crypto", image: require("../../assets/home/crypto.jpg") },
];

export default function HomeScreen({ onOpen }: { onOpen: (t: HomeTarget) => void }) {
  const { refreshing, refresh } = useGold();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={colors.primary} />}
    >
      <MggBanner />
      {CARDS.map((c) => (
        <TouchableOpacity key={c.key} activeOpacity={0.85} onPress={() => onOpen(c.key)} style={styles.cardWrap}>
          <ImageBackground source={c.image} style={styles.card} imageStyle={styles.cardImage} resizeMode="cover">
            <View style={styles.shade} />
            <Text style={styles.title}>{c.title}</Text>
          </ImageBackground>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: 16 },
  cardWrap: { marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  card: { height: 150, alignItems: "center", justifyContent: "center" },
  cardImage: { borderRadius: 18 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,10,28,0.38)" },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
