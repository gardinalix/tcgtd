/** Bandai is tracked for official event discovery; no private/authenticated endpoint is used. */
export const bandaiAdapter = Object.freeze({
  id: "bandai-official",
  async discover() {
    return ["https://www.gundam-gcg.com/en/"];
  },
  async fetch() {
    return { status: "tracked", reason: "No stable public competitive-result feed has been confirmed." };
  },
  parse() {
    return [];
  },
  normalize() {
    return [];
  },
  preferred_transport: "official JSON or embedded structured data",
});
