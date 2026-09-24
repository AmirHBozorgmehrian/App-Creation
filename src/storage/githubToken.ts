import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "github:pat";

export async function getGithubToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setGithubToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token.trim());
}
