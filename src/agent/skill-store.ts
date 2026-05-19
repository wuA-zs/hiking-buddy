import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Skill } from "./types";

const STORAGE_KEY = "user_skills";

export const skillStore = {
  async load(): Promise<Skill[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const items: Array<{ name: string; description: string; content: string; disableModelInvocation?: boolean }> = JSON.parse(raw);
      return items.map((item) => ({
        ...item,
        source: "user" as const,
      }));
    } catch {
      return [];
    }
  },

  async save(skill: Skill): Promise<void> {
    const skills = await this.load();
    const idx = skills.findIndex((s) => s.name === skill.name);
    if (idx >= 0) {
      skills[idx] = { ...skill, source: "user" };
    } else {
      skills.push({ ...skill, source: "user" });
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
  },

  async remove(name: string): Promise<void> {
    const skills = await this.load();
    const filtered = skills.filter((s) => s.name !== name);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async list(): Promise<Skill[]> {
    return this.load();
  },
};
