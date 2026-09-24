import { Platform, PermissionsAndroid } from "react-native";
import messaging from "@react-native-firebase/messaging";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PUSH_TOKENS_PATH } from "../config";
import { readJsonFile, writeJsonFile } from "../api/githubApi";

const LAST_SYNCED_TOKEN_KEY = "push:lastSyncedToken";

interface PushTokensPayload {
  tokens: string[];
}

/**
 * Requests notification permission (required on Android 13+), gets this
 * device's FCM token, and registers it in the shared GitHub file so the
 * GitHub Action knows where to send emergency alerts. Safe to call on
 * every app start - it only writes to GitHub when the token actually
 * changed since the last successful sync.
 */
export async function registerForPushAlerts(): Promise<void> {
  try {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }

    const token = await messaging().getToken();
    const lastSynced = await AsyncStorage.getItem(LAST_SYNCED_TOKEN_KEY);
    if (token === lastSynced) return; // already registered, nothing to do

    const existing = await readJsonFile<PushTokensPayload>(PUSH_TOKENS_PATH);
    const tokens = new Set(existing?.tokens ?? []);
    tokens.add(token);

    await writeJsonFile(
      PUSH_TOKENS_PATH,
      { tokens: Array.from(tokens) },
      "Register device for push alerts"
    );
    await AsyncStorage.setItem(LAST_SYNCED_TOKEN_KEY, token);
  } catch {
    // No GitHub token set yet, or offline - this just means this device
    // won't receive alerts until it succeeds on a later app open.
  }
}
