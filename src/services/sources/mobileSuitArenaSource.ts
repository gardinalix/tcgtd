import { createManualSource } from "./sourceTypes";

export const mobileSuitArenaSource = createManualSource({
  name: "Mobile Suit Arena",
  baseUrl: "https://mobilesuitarena.com/",
  // Public home index confirmed, but the match-level analytical feed is still unconfirmed.
  status: "manual",
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
