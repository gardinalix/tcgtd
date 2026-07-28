import { createManualSource } from "./sourceTypes";

export const bandaiOfficialSource = createManualSource({
  name: "Bandai Official Gundam GCG",
  baseUrl: "https://www.gundam-gcg.com/en/",
  status: "ready",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /GD\d+|ST\d+|card|product|news/i.test(line));
  },
  normalizer(item: string) {
    return {
      source: "Bandai Official",
      type: "official_card_product_or_preview",
      raw: item,
      status: "official_review",
    };
  },
});
