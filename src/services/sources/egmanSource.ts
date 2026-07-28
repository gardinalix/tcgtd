import { createManualSource } from "./sourceTypes";

export const egmanSource = createManualSource({
  name: "Egman Events Gundam",
  baseUrl: "https://egmanevents.com/gundam",
  status: "ready",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },
  normalizer(item: string) {
    return {
      source: "Egman Events",
      type: "event_or_decklist",
      raw: item,
      status: "manual_review",
    };
  },
});
