export function materializeStoreSchedules({ schedules = [], exceptions = [], from, to } = {}) {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (!start || !end || start > end) return [];

  const exceptionsByScheduleDate = new Map(
    exceptions
      .filter((exception) => exception?.scheduleId && isDateKey(exception?.occurrenceDate))
      .map((exception) => [`${exception.scheduleId}:${exception.occurrenceDate}`, exception]),
  );
  const occurrences = [];

  for (const schedule of schedules) {
    if (!schedule?.active || !Number.isInteger(Number(schedule.weekday))) continue;
    const weekday = Number(schedule.weekday);
    if (weekday < 0 || weekday > 6) continue;

    for (const date of matchingWeekdays(start, end, weekday)) {
      const eventDate = dateKey(date);
      if (!isWithinScheduleRange(eventDate, schedule)) continue;
      const exception = exceptionsByScheduleDate.get(`${schedule.id}:${eventDate}`);
      if (exception?.kind === "cancelled") continue;
      occurrences.push(scheduleOccurrence(schedule, eventDate, exception));
    }
  }

  return occurrences.sort((left, right) => (
    String(left.eventDate).localeCompare(String(right.eventDate))
    || String(left.startTime || "").localeCompare(String(right.startTime || ""))
    || String(left.organizer || "").localeCompare(String(right.organizer || ""))
  ));
}

export function confirmedWeeklies(schedules = []) {
  return schedules
    .filter((schedule) => schedule?.active && Number.isInteger(Number(schedule.weekday)))
    .map((schedule) => ({
      id: schedule.id,
      organizer: schedule.venueName || "Store",
      name: schedule.name || "Weekly event",
      weekday: Number(schedule.weekday),
      startTime: schedule.startTime || "",
      formatName: schedule.formatName || "",
      status: "confirmed",
    }))
    .sort((left, right) => left.weekday - right.weekday || left.organizer.localeCompare(right.organizer));
}

export function calendarRange(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const from = new Date(year, monthIndex, 1 - firstDay.getDay());
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 41);
  return { from: dateKey(from), to: dateKey(to) };
}

function scheduleOccurrence(schedule, eventDate, exception) {
  const isOverride = exception?.kind === "override";
  return {
    eventId: `schedule:${schedule.id}:${eventDate}`,
    eventDate,
    organizer: schedule.venueName || "Store",
    eventName: isOverride && exception.name ? exception.name : (schedule.name || "Weekly event"),
    eventType: "Store weekly",
    formatName: isOverride && exception.formatName ? exception.formatName : (schedule.formatName || ""),
    startTime: isOverride && exception.startTime ? exception.startTime : (schedule.startTime || ""),
    city: schedule.city || "",
    state: schedule.region || "",
    region: schedule.region || "",
    country: schedule.country || "",
    sourceName: "Organizer-confirmed schedule",
    sourceUrl: isOverride && exception.registrationUrl ? exception.registrationUrl : (schedule.registrationUrl || ""),
    description: isOverride && exception.description ? exception.description : (schedule.description || ""),
    scheduleId: schedule.id,
    calendarKind: isOverride ? "schedule-override" : "confirmed-weekly",
  };
}

function matchingWeekdays(start, end, weekday) {
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  first.setDate(first.getDate() + ((weekday - first.getDay() + 7) % 7));
  const dates = [];
  for (let date = first; date <= end; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)) {
    dates.push(date);
  }
  return dates;
}

function isWithinScheduleRange(date, schedule) {
  return (!isDateKey(schedule.startDate) || date >= schedule.startDate)
    && (!isDateKey(schedule.endDate) || date <= schedule.endDate);
}

function parseDateKey(value) {
  if (!isDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
