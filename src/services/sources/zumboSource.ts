import { createManualSource } from "./sourceTypes";

export const zumboSource = createManualSource({
  name: "ZumboSim",
  baseUrl: "https://zumbosim.com/",
  status: "blocked",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },
  normalizer(item: string) {
    return {
      source: "ZumboSim",
      type: "digital_deck_signal",
      raw: item,
      status: "manual_review",
      competitiveScope: "digital_platform",
    };
  },
});
