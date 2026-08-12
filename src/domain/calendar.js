const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCalendarDays(year, monthIndex, events = []) {
  const firstDay = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());
  const eventsByDate = new Map();

  for (const event of events) {
    const dateKey = normalizeDateKey(event.eventDate);
    if (!dateKey) continue;
    const rows = eventsByDate.get(dateKey) || [];
    rows.push(event);
    eventsByDate.set(dateKey, rows);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      day: date.getDate(),
      inCurrentMonth: date.getFullYear() === year && date.getMonth() === monthIndex,
      events: (eventsByDate.get(dateKey) || []).slice().sort(compareCalendarEvents),
    };
  });
}

export function buildObservedWeeklies(events = [], minimumOccurrences = 3) {
  const groups = new Map();

  for (const event of events) {
    const dateKey = normalizeDateKey(event.eventDate);
    const organizer = String(event.organizer || "").trim();
    if (!dateKey || !organizer) continue;
    const date = dateFromKey(dateKey);
    const weekday = date.getDay();
    const id = `${normalizeIdentity(organizer)}::${weekday}`;
    const row = groups.get(id) || {
      id,
      organizer,
      weekday,
      events: [],
      dates: new Set(),
    };
    row.events.push(event);
    row.dates.add(dateKey);
    groups.set(id, row);
  }

  return [...groups.values()]
    .map((row) => {
      const dates = [...row.dates].sort();
      return {
        ...row,
        dates,
        eventIds: row.events.map((event) => event.eventId).filter(Boolean),
        longestWeeklyRun: longestWeeklyRun(dates),
        latestDate: dates.at(-1) || "",
      };
    })
    .filter((row) => row.dates.length >= minimumOccurrences && row.longestWeeklyRun >= minimumOccurrences)
    .sort((left, right) => right.latestDate.localeCompare(left.latestDate) || left.organizer.localeCompare(right.organizer));
}

export function filterStoreEvents(events = [], query = "") {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return events;
  return events.filter((event) => [
    event.eventName,
    event.organizer,
    event.eventType,
    event.formatName,
    event.city,
    event.state,
    event.region,
    event.country,
  ].join(" ").toLocaleLowerCase().includes(needle));
}

export function isEventInMonth(event, year, monthIndex) {
  const parts = dateParts(event?.eventDate);
  return Boolean(parts && parts.year === year && parts.month === monthIndex + 1);
}

export function moveCalendarMonth(year, monthIndex, delta) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function currentCalendarMonth(now = new Date()) {
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function compareCalendarEvents(left, right) {
  return String(left.startTime || "").localeCompare(String(right.startTime || ""))
    || String(left.organizer || left.eventName || "").localeCompare(String(right.organizer || right.eventName || ""));
}

function longestWeeklyRun(dateKeys) {
  if (!dateKeys.length) return 0;
  let longest = 1;
  let current = 1;
  for (let index = 1; index < dateKeys.length; index += 1) {
    const previous = dateFromKey(dateKeys[index - 1]);
    const next = dateFromKey(dateKeys[index]);
    const difference = Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate())
      - Date.UTC(previous.getFullYear(), previous.getMonth(), previous.getDate())) / DAY_MS);
    current = difference === 7 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function normalizeDateKey(value) {
  const parts = dateParts(value);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function dateFromKey(dateKey) {
  const parts = dateParts(dateKey);
  return new Date(parts.year, parts.month - 1, parts.day);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
