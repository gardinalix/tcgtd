import { createManualSource } from "./sourceTypes";

export const exburstSource = createManualSource({
  name: "ExBurst Gundam",
  baseUrl: "https://exburst.dev/gundam",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },
  normalizer(item: string) {
    return {
      source: "ExBurst Gundam",
      type: "deck_or_card_reference",
      raw: item,
      status: "manual_review",
    };
  },
});
