export type SourceStatus = "manual" | "ready" | "blocked" | "disabled";

export type SourceRunResult<T = unknown> = {
  sourceName: string;
  status: "success" | "manual_required" | "error";
  found: number;
  items: T[];
  error?: string;
  fetchedAt: string;
};

export type DataSource<T = unknown> = {
  name: string;
  baseUrl: string;
  status: SourceStatus;
  fetch: () => Promise<string>;
  parse: (payload: string) => T[];
  normalize: (item: T) => Record<string, unknown>;
  run: () => Promise<SourceRunResult<Record<string, unknown>>>;
};

export function createManualSource<T>({
  name,
  baseUrl,
  status = "manual",
  parser,
  normalizer,
}: {
  name: string;
  baseUrl: string;
  status?: SourceStatus;
  parser: (payload: string) => T[];
  normalizer: (item: T) => Record<string, unknown>;
}): DataSource<T> {
  return {
    name,
    baseUrl,
    status,
    async fetch() {
      throw new Error(`${name} is configured as manual/importable until source permissions and API access are confirmed.`);
    },
    parse: parser,
    normalize: normalizer,
    async run() {
      return {
        sourceName: name,
        status: "manual_required",
        found: 0,
        items: [],
        fetchedAt: new Date().toISOString(),
        error: "Manual CSV/import flow required for this source.",
      };
    },
  };
}
