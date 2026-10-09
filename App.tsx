import React, { useEffect, useState } from "react";
import { BackHandler, SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { syncBackgroundCheck } from "./src/arbitrage/backgroundTask"; // also defines the background task
import { loadSettings } from "./src/arbitrage/settings";
import StockListScreen from "./src/screens/StockListScreen";
import HomeScreen, { HomeTarget } from "./src/screens/HomeScreen";
import GoldScreen from "./src/screens/GoldScreen";
import GoldDetailScreen from "./src/screens/GoldDetailScreen";
import PlaceholderScreen from "./src/screens/PlaceholderScreen";
import { GoldProvider } from "./src/gold/GoldContext";
import { GoldItem } from "./shared/gold";
import { colors } from "./src/theme";

type Route =
  | { name: "home" }
  | { name: "stock" }
  | { name: "gold" }
  | { name: "goldDetail"; item: GoldItem; section: string }
  | { name: "placeholder"; title: string };

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const route = stack[stack.length - 1];
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  // Re-arm the background swap check after a restart / update.
  useEffect(() => {
    loadSettings().then((s) => syncBackgroundCheck(s.enabled));
  }, []);

  // Android back button / gesture goes up one screen, and only exits from Home.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const open = (t: HomeTarget) => {
    if (t === "stock") push({ name: "stock" });
    else if (t === "gold") push({ name: "gold" });
    else push({ name: "placeholder", title: t === "currencies" ? "Currencies" : "Crypto" });
  };

  return (
    <GoldProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        {route.name === "home" && <HomeScreen onOpen={open} />}
        {route.name === "stock" && <StockListScreen />}
        {route.name === "gold" && (
          <GoldScreen onBack={pop} onOpenItem={(item, section) => push({ name: "goldDetail", item, section })} />
        )}
        {route.name === "goldDetail" && <GoldDetailScreen item={route.item} sectionTitle={route.section} onBack={pop} />}
        {route.name === "placeholder" && <PlaceholderScreen title={route.title} />}
      </SafeAreaView>
    </GoldProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
