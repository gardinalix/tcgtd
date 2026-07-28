import { createManualSource } from "./sourceTypes";

export const twitterXSource = createManualSource({
  name: "X / Twitter Official Preview Watch",
  baseUrl: "https://x.com/",
  status: "manual",
  parser(payload: string) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  },
  normalizer(item: string) {
    return {
      source: "X/Twitter",
      type: "official_or_semi_official_preview_candidate",
      raw: item,
      status: "manual_review",
      reliability: "unverified_until_source_url_review",
    };
  },
});
