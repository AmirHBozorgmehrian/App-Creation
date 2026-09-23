import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "followings:insCodes";

export async function loadFollowings(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function saveFollowings(followings: Set<string>): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(followings)));
}
