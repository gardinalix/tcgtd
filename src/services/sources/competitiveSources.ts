import { egmanSource } from "./egmanSource";
import { exburstSource } from "./exburstSource";
import { mobileSuitArenaSource } from "./mobileSuitArenaSource";
import { zumboSource } from "./zumboSource";

export const COMPETITIVE_SOURCES = [
  {
    ...egmanSource,
    category: "official_or_paper_event",
    automationLevel: "structured_fetch",
    targetCut: 16,
  },
  {
    name: "Limitless Gundam",
    baseUrl: "https://play.limitlesstcg.com/tournaments/completed?game=GUNDAM",
    status: "ready",
    category: "official_or_public_event",
    automationLevel: "structured_fetch",
    targetCut: 16,
  },
  {
    ...exburstSource,
    category: "public_deck_platform",
    automationLevel: "manual_or_profile_import",
    targetCut: null,
  },
  {
    ...mobileSuitArenaSource,
    category: "digital_platform",
    automationLevel: "permission_gated",
    targetCut: 16,
  },
  {
    ...zumboSource,
    category: "digital_platform",
    automationLevel: "permission_gated",
    targetCut: 16,
  },
];
