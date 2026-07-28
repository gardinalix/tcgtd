import { createManualSource } from "./sourceTypes";

export const mobileSuitArenaSource = createManualSource({
  name: "Mobile Suit Arena",
  baseUrl: "https://beta.mobilesuitarena.com/",
  status: "blocked",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },
  normalizer(item: string) {
    return {
      source: "Mobile Suit Arena",
      type: "digital_deck_signal",
      raw: item,
      status: "manual_review",
      competitiveScope: "digital_platform",
    };
  },
});
