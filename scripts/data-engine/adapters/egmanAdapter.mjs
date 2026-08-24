/**
 * Source contract for Egman. The existing public-page collector is invoked by
 * data-engine.mjs during update; its rows then enter only through csvLegacyAdapter.
 * Keeping this descriptor separate prevents the application from coupling to HTML.
 */
export const egmanAdapter = Object.freeze({
  id: "egman-events",
  async discover() {
    return ["https://egmanevents.com/gundam-gd01-format", "https://egmanevents.com/gundam-gd02-format", "https://egmanevents.com/gundam-gd03-format"];
  },
  async fetch({ runCollector }) {
    return runCollector();
  },
  parse(payload) {
    return payload;
  },
  normalize(payload) {
    return payload;
  },
  preferred_transport: "structured or embedded data before public HTML",
});
