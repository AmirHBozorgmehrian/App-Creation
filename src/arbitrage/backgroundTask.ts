// Imported once from App.tsx so the task is defined even when Android starts the
// app in the background just to run it.
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { isIranBusinessTime } from "../../shared/gold";
import { fetchCoinItems } from "../gold/goldService";
import { checkAndNotify } from "./engine";
import { loadSettings } from "./settings";

const TASK = "gold-swap-check";

TaskManager.defineTask(TASK, async () => {
  try {
    if (!isIranBusinessTime(new Date())) return BackgroundFetch.BackgroundFetchResult.NoData;
    const s = await loadSettings();
    if (!s.enabled) return BackgroundFetch.BackgroundFetchResult.NoData;
    await checkAndNotify(await fetchCoinItems(), s);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Registers (or removes) the periodic check. Android decides the exact timing (>= 15 min). */
export async function syncBackgroundCheck(enabled: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK);
    if (enabled && !registered) {
      await BackgroundFetch.registerTaskAsync(TASK, { minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true });
    } else if (!enabled && registered) {
      await BackgroundFetch.unregisterTaskAsync(TASK);
    }
  } catch {
    /* background fetch can be unavailable (battery saver); foreground checks still work */
  }
}
