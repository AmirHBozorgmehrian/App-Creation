// Imported once from App.tsx so the task is defined even when Android starts the
// app in the background just to run it.
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { REFRESH_EVERY_MS, isIranBusinessTime } from "../../shared/gold";
import { fetchGold, loadCachedSnapshot, saveCachedSnapshot } from "../gold/goldService";
import { coinItemsFromSnapshot, onCoinPrices } from "./engine";

const TASK = "gold-swap-check";

// Runs about every 30 min, also when the app is closed: refreshes ALL gold data,
// saves it (so the app opens with fresh prices) and runs the swap check.
TaskManager.defineTask(TASK, async () => {
  try {
    if (!isIranBusinessTime(new Date())) return BackgroundFetch.BackgroundFetchResult.NoData;
    const snap = await fetchGold(await loadCachedSnapshot());
    await saveCachedSnapshot(snap);
    await onCoinPrices(coinItemsFromSnapshot(snap)); // saves prices; alerts only when switched on
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Makes sure the periodic refresh is scheduled. Android decides the exact timing. */
export async function ensureBackgroundRefresh(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundFetch.registerTaskAsync(TASK, {
      minimumInterval: Math.round(REFRESH_EVERY_MS / 1000),
      stopOnTerminate: false, // keep going after the app is swiped away
      startOnBoot: true, // and after a phone restart
    });
  } catch {
    /* unavailable (battery saver / restricted); the app still refreshes while open */
  }
}
