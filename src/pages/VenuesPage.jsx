import { useEffect, useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import {
  buildCalendarDays,
  buildObservedWeeklies,
  currentCalendarMonth,
  filterStoreEvents,
  isEventInMonth,
  moveCalendarMonth,
} from "../domain/calendar";
import { loadPublicCommunitySchedules } from "../domain/communityScheduleApi";
import { calendarRange, confirmedWeeklies, materializeStoreSchedules } from "../domain/communitySchedules";
import { buildCommunitySnapshot } from "../domain/community";
import { useLocale } from "../i18n/LocaleProvider";

const MAX_VISIBLE_EVENTS_PER_DAY = 4;

export function VenuesPage({ data, onNavigate }) {
  const snapshot = useMemo(() => buildCommunitySnapshot(data), [data]);
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(currentCalendarMonth);
  const [scheduleData, setScheduleData] = useState({ schedules: [], exceptions: [], available: false });

  useEffect(() => {
    let mounted = true;
    loadPublicCommunitySchedules()
      .then((payload) => {
        if (mounted) setScheduleData({
          schedules: Array.isArray(payload.schedules) ? payload.schedules : [],
          exceptions: Array.isArray(payload.exceptions) ? payload.exceptions : [],
          available: Boolean(payload.available),
        });
      })
      .catch(() => {
        if (mounted) setScheduleData({ schedules: [], exceptions: [], available: false });
      });
    return () => { mounted = false; };
  }, []);

  const range = useMemo(() => calendarRange(calendarMonth.year, calendarMonth.monthIndex), [calendarMonth]);
  const scheduledEvents = useMemo(() => materializeStoreSchedules({
    schedules: scheduleData.schedules,
    exceptions: scheduleData.exceptions,
    ...range,
  }), [range, scheduleData]);
  const allEvents = useMemo(() => [...snapshot.events, ...scheduledEvents], [scheduledEvents, snapshot.events]);
  const filteredEvents = useMemo(() => filterStoreEvents(allEvents, query), [allEvents, query]);
  const observedWeeklies = useMemo(() => buildObservedWeeklies(snapshot.events), [snapshot.events]);
  const confirmed = useMemo(() => confirmedWeeklies(scheduleData.schedules), [scheduleData.schedules]);
  const visibleObservedWeeklies = observedWeeklies.filter((weekly) => `${weekly.organizer} ${weekdayName(weekly.weekday, locale)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const visibleConfirmedWeeklies = confirmed.filter((weekly) => `${weekly.organizer} ${weekly.name} ${weekdayName(weekly.weekday, locale)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const weeklyEventIds = useMemo(() => new Set(observedWeeklies.flatMap((weekly) => weekly.eventIds)), [observedWeeklies]);
  const observedByOrganizer = useMemo(() => new Map(observedWeeklies.map((weekly) => [weekly.organizer.toLocaleLowerCase(), weekly])), [observedWeeklies]);
  const confirmedByOrganizer = useMemo(() => new Map(confirmed.map((weekly) => [weekly.organizer.toLocaleLowerCase(), weekly])), [confirmed]);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth.year, calendarMonth.monthIndex, filteredEvents),
    [calendarMonth, filteredEvents],
  );
  const monthEvents = filteredEvents.filter((event) => isEventInMonth(event, calendarMonth.year, calendarMonth.monthIndex));
  const eventDays = new Set(monthEvents.map((event) => String(event.eventDate || "").slice(0, 10))).size;
  const venues = useMemo(
    () => mergeVenues(snapshot.venues, scheduleData.schedules)
      .filter((venue) => `${venue.name} ${venue.cities.join(" ")} ${venue.countries.join(" ")}`.toLowerCase().includes(query.toLowerCase())),
    [query, scheduleData.schedules, snapshot.venues],
  );
  const todayKey = dateKey(new Date());

  const changeMonth = (delta) => setCalendarMonth((current) => moveCalendarMonth(current.year, current.monthIndex, delta));
  const returnToToday = () => setCalendarMonth(currentCalendarMonth());

  return (
    <TacticalPageShell className="venues-terminal-page">
      <CommunityNav active="venues" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="Community / local scene"
        title="Store calendar"
        subtitle="A full-month view of archived events and community-maintained weekly store schedules. Historical repetition is always marked separately from a confirmed schedule."
        actions={(
          <div className="venue-calendar-actions">
            <input className="venue-calendar-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Store, event, format or city..." />
            <button type="button" className="venue-manage-button" onClick={() => onNavigate("scheduleManager")}>Manage schedules</button>
          </div>
        )}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Stores indexed" value={venues.length} tone="blue" />
        <TacticalSummaryCard label="Events this month" value={monthEvents.length} tone="green" />
        <TacticalSummaryCard label="Days with events" value={eventDays} />
        <TacticalSummaryCard label="Confirmed weeklies" value={visibleConfirmedWeeklies.length} detail={scheduleData.available ? "Community-maintained future schedules." : "No schedule service available yet."} tone="gold" />
      </TacticalSummaryStrip>

      <div className="venue-finder-grid">
        <section className="venue-calendar-shell" aria-label="Store event calendar">
          <header className="venue-calendar-toolbar">
            <div className="venue-calendar-toolbar__controls">
              <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
              <button type="button" onClick={returnToToday}>Today</button>
              <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
            </div>
            <div>
              <span>CALENDAR // MONTH VIEW</span>
              <h2 data-no-translate>{monthTitle(calendarMonth.year, calendarMonth.monthIndex, locale)}</h2>
            </div>
            <div className="venue-calendar-legend" aria-label="Calendar legend">
              <span><i className="is-confirmed" /> Community schedule</span>
              <span><i className="is-weekly" /> Observed weekly</span>
              <span><i className="is-event" /> Indexed event</span>
            </div>
          </header>

          <div className="venue-weekly-radar">
            <strong>Weekly radar</strong>
            <div>
              {visibleConfirmedWeeklies.map((weekly) => <WeeklyBadge key={weekly.id} weekly={weekly} locale={locale} confirmed />)}
              {visibleObservedWeeklies.map((weekly) => <WeeklyBadge key={weekly.id} weekly={weekly} locale={locale} />)}
              {!visibleConfirmedWeeklies.length && !visibleObservedWeeklies.length ? <p>No recurring weekday detected.</p> : null}
            </div>
            <small>{visibleConfirmedWeeklies.length ? "Green: community-maintained future schedule. Purple: repeated pattern in the indexed archive." : "Purple signals are historical observations, not a promise of a future event."}</small>
          </div>

          <div className="venue-calendar-scroll">
            <div className="venue-calendar" role="grid" aria-label="Calendar month">
              <div className="venue-calendar__weekdays" role="row">
                {Array.from({ length: 7 }, (_, weekday) => (
                  <span key={weekday} role="columnheader" data-no-translate>{weekdayShortName(weekday, locale)}</span>
                ))}
              </div>
              <div className="venue-calendar__days">
                {calendarDays.map((day) => (
                  <CalendarDay
                    key={day.dateKey}
                    day={day}
                    todayKey={todayKey}
                    locale={locale}
                    weeklyEventIds={weeklyEventIds}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <TacticalDataPanel title="Store index" subtitle={`${venues.length} stores from the historical archive or a maintained schedule.`} className="venue-directory-panel">
          <div className="venue-directory-list venue-directory-list--calendar">
            {venues.map((venue) => {
              const confirmedWeekly = confirmedByOrganizer.get(venue.name.toLocaleLowerCase());
              const observedWeekly = observedByOrganizer.get(venue.name.toLocaleLowerCase());
              return (
                <article key={venue.id}>
                  <span>{confirmedWeekly ? "SCHEDULED WEEKLY" : (observedWeekly ? "WEEKLY OBSERVED" : (venue.online ? "ONLINE" : venue.countries[0] || "LOCATION PENDING"))}</span>
                  <h2>{venue.name}</h2>
                  <p>{venueDescription(confirmedWeekly, observedWeekly, venue, locale)}</p>
                  <dl>
                    <div><dt>Events</dt><dd>{venue.eventCount}</dd></div>
                    <div><dt>Results</dt><dd>{venue.resultCount}</dd></div>
                    <div><dt>Largest field</dt><dd>{venue.playerCapacityObserved || "-"}</dd></div>
                    <div><dt>Latest</dt><dd>{venue.latestEventDate || "-"}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </TacticalDataPanel>
      </div>
    </TacticalPageShell>
  );
}

function CalendarDay({ day, todayKey, locale, weeklyEventIds }) {
  const visibleEvents = day.events.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
  return (
    <article
      className={`venue-calendar-day${day.inCurrentMonth ? "" : " is-outside"}${day.dateKey === todayKey ? " is-today" : ""}`}
      role="gridcell"
      aria-label={`${formatFullDate(day.date, locale)}: ${day.events.length} events`}
    >
      <header><time dateTime={day.dateKey} data-no-translate>{day.day}</time>{day.dateKey === todayKey ? <span>Today</span> : null}</header>
      <div>
        {visibleEvents.map((event) => <CalendarEvent key={event.eventId} event={event} observedWeekly={weeklyEventIds.has(event.eventId)} />)}
        {day.events.length > MAX_VISIBLE_EVENTS_PER_DAY ? <span className="venue-calendar-more">+{day.events.length - MAX_VISIBLE_EVENTS_PER_DAY} more events</span> : null}
      </div>
    </article>
  );
}

function CalendarEvent({ event, observedWeekly }) {
  const confirmed = event.calendarKind === "confirmed-weekly" || event.calendarKind === "schedule-override";
  const classes = `venue-calendar-event${confirmed ? " is-confirmed" : ""}${observedWeekly ? " is-weekly" : ""}`;
  const content = <>
    <strong>{event.startTime ? `${event.startTime} · ` : ""}{event.organizer || event.eventName}</strong>
    <small>{event.eventName}{event.formatName ? ` · ${event.formatName}` : ""}</small>
    {confirmed ? <em>{event.calendarKind === "schedule-override" ? "UPDATED" : "SCHEDULE"}</em> : observedWeekly ? <em>WEEKLY</em> : null}
  </>;
  if (confirmed && event.sourceUrl) {
    return <a className={classes} href={event.sourceUrl} target="_blank" rel="noreferrer" title={`${event.eventName} — ${event.organizer}`}>{content}</a>;
  }
  if (confirmed) return <span className={classes} title={`${event.eventName} — ${event.organizer}`}>{content}</span>;
  return <a className={classes} href={`/community/events/${encodeURIComponent(event.eventId)}`} title={`${event.eventName} — ${event.organizer || event.sourceName}`}>{content}</a>;
}

function WeeklyBadge({ weekly, locale, confirmed = false }) {
  return (
    <span className={confirmed ? "is-confirmed" : ""}>
      <b data-no-translate>{weekdayName(weekly.weekday, locale)}</b>
      {weekly.organizer}
      <small>{confirmed ? `${weekly.name}${weekly.startTime ? ` · ${weekly.startTime}` : ""}` : `${weekly.dates.length} indexed dates`}</small>
    </span>
  );
}

function mergeVenues(indexedVenues, schedules) {
  const rows = new Map(indexedVenues.map((venue) => [venue.name.toLocaleLowerCase(), venue]));
  for (const schedule of schedules) {
    const key = String(schedule.venueName || "").toLocaleLowerCase();
    if (!key || rows.has(key)) continue;
    rows.set(key, {
      id: schedule.venueId || schedule.id,
      name: schedule.venueName,
      cities: schedule.city ? [schedule.city] : [],
      countries: schedule.country ? [schedule.country] : [],
      online: false,
      eventCount: 0,
      resultCount: 0,
      playerCapacityObserved: 0,
      latestEventDate: "",
    });
  }
  return [...rows.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function monthTitle(year, monthIndex, locale) {
  const value = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, monthIndex, 1));
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

function weekdayName(weekday, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 7, 2 + weekday));
}

function weekdayShortName(weekday, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 7, 2 + weekday)).replace(".", "").toLocaleUpperCase(locale);
}

function formatFullDate(date, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date);
}

function venueDescription(confirmed, observed, venue, locale) {
  if (confirmed) return `${confirmed.name} · ${weekdayName(confirmed.weekday, locale)}${confirmed.startTime ? ` at ${confirmed.startTime}` : ""}.`;
  if (observed) return `Observed on ${weekdayName(observed.weekday, locale)} · ${observed.dates.length} indexed dates.`;
  return venue.cities.join(", ") || "No recurring weekday detected.";
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
