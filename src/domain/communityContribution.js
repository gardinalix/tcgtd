export const CONTRIBUTION_SCHEMA = "tcgtd-community-event-v1";

export function safePublicUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function validateContribution(input, now = new Date()) {
  const errors = [];
  const raw = input?.event || {};
  const text = (value, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const event = {
    name: text(raw.name), date: text(raw.date, 160), organizer: text(raw.organizer),
    country: text(raw.country, 2).toUpperCase(), city: text(raw.city), format: text(raw.format, 40),
    sourceUrl: safePublicUrl(raw.sourceUrl),
    playerCount: raw.playerCount === "" || raw.playerCount == null ? null : Number(raw.playerCount),
  };
  if (input?.schemaVersion !== CONTRIBUTION_SCHEMA) errors.push("Unsupported contribution format.");
  if (!event.name || !event.organizer) errors.push("Event name and organizer are required.");
  const time = Date.parse(`${event.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== event.date || event.date > now.toISOString().slice(0, 10)) errors.push("Use a valid event date, today or earlier.");
  if (!event.sourceUrl) errors.push("Provide an http(s) source URL without credentials.");
  if (event.country && !/^[A-Z]{2}$/.test(event.country)) errors.push("Country must use two letters, such as BR.");
  if (event.playerCount !== null && (!Number.isInteger(event.playerCount) || event.playerCount < 1 || event.playerCount > 100000)) errors.push("Participant count must be a positive integer.");
  const rows = Array.isArray(input?.results) ? input.results : [];
  if (!rows.length || rows.length > 256) errors.push("Provide between 1 and 256 results.");
  const players = new Set();
  const results = rows.slice(0, 256).map((row, index) => {
    const playerName = text(row?.playerName);
    const placement = Number(row?.placement);
    const deckUrl = text(row?.deckUrl, 4096);
    if (!playerName || players.has(playerName.toLocaleLowerCase())) errors.push(`Result ${index + 1}: use a distinct public player name.`);
    players.add(playerName.toLocaleLowerCase());
    if (!Number.isInteger(placement) || placement < 1 || placement > 100000 || (event.playerCount !== null && placement > event.playerCount)) errors.push(`Result ${index + 1}: invalid placement.`);
    if (deckUrl && !safePublicUrl(deckUrl)) errors.push(`Result ${index + 1}: invalid deck URL.`);
    return { playerName, placement, archetype: text(row?.archetype), deckUrl: safePublicUrl(deckUrl) };
  });
  if (event.playerCount !== null && results.length > event.playerCount) errors.push("Results exceed participant count.");
  if (input?.publicDataConfirmed !== true) errors.push("Confirm that the submitted results may be published.");
  return { valid: errors.length === 0, errors, value: { schemaVersion: CONTRIBUTION_SCHEMA, status: "pending_review", publicDataConfirmed: input?.publicDataConfirmed === true, event, results } };
}

export function contributionError(error, locale) {
  if (locale !== "pt-BR") return error;
  const messages = {
    "Unsupported contribution format.": "Formato de contribuição incompatível.",
    "Event name and organizer are required.": "Informe o nome do evento e o organizador.",
    "Use a valid event date, today or earlier.": "Informe uma data válida, até hoje.",
    "Provide an http(s) source URL without credentials.": "Informe um link http(s) da fonte, sem credenciais.",
    "Country must use two letters, such as BR.": "Use duas letras para o país, como BR.",
    "Participant count must be a positive integer.": "O número de participantes deve ser inteiro e positivo.",
    "Provide between 1 and 256 results.": "Informe entre 1 e 256 resultados.",
    "Results exceed participant count.": "Há mais resultados que participantes.",
    "Confirm that the submitted results may be published.": "Confirme que os resultados podem ser publicados.",
  };
  return messages[error] || error.replace(/^Result (\d+): use a distinct public player name\.$/, "Resultado $1: informe um apelido público sem repetir outro jogador.")
    .replace(/^Result (\d+): invalid placement\.$/, "Resultado $1: colocação inválida.")
    .replace(/^Result (\d+): invalid deck URL\.$/, "Resultado $1: link do deck inválido.");
}
