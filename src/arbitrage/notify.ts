import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { Swap } from "../../shared/gold";
import { fmtInt } from "../utils/format";

const CHANNEL = "gold-swaps";

// Show the notification even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Gold swap alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
  });
}

/** Asks for notification permission (Android 13+ shows a system prompt). */
export async function ensurePermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function send(title: string, body: string) {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === "android" ? ({ channelId: CHANNEL } as any) : null,
  });
}

export function swapText(s: Swap): { title: string; body: string } {
  const title = `Gold swap: +${s.pct.toFixed(1)}% (${fmtInt(s.profit)} Toman)`;
  const body =
    `SELL ${s.sellCount}× ${s.sellTitle}\n` +
    `   ${fmtInt(s.sellUnit)} each = ${fmtInt(s.proceeds)}\n` +
    `BUY ${s.buyCount}× ${s.buyTitle}\n` +
    `   ${fmtInt(s.buyUnit)} each = ${fmtInt(s.cost)}\n` +
    `KEEP ${fmtInt(s.profit)} Toman · same gold (${s.grams.toFixed(2)} g of coin)`;
  return { title, body };
}

export async function sendSwapNotification(s: Swap) {
  const t = swapText(s);
  await send(t.title, t.body);
}

export async function sendSummaryNotification(count: number, best: Swap) {
  await send(`${count} gold swaps above your threshold`, `Best: +${best.pct.toFixed(1)}% (${fmtInt(best.profit)} Toman). Open the app, Gold, Swaps.`);
}

export async function sendTestNotification() {
  await send("Gold swap alerts are on", "You will get a message like this when a swap beats your threshold.");
}
