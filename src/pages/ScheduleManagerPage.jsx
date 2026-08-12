import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import {
  createCommunitySchedule,
  createCommunityScheduleException,
  deleteCommunityScheduleException,
  loadManagedCommunitySchedules,
  setCommunityScheduleActive,
} from "../domain/communityScheduleApi";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const INITIAL_SCHEDULE = {
  venueName: "",
  city: "",
  region: "",
  country: "Brasil",
  timeZone: "America/Sao_Paulo",
  websiteUrl: "",
  name: "Gundam Card Game Weekly",
  weekday: "",
  startTime: "",
  formatName: "Standard",
  entryFeeText: "",
  registrationUrl: "",
  description: "",
  startDate: "",
  endDate: "",
};

export function ScheduleManagerPage({ onNavigate }) {
  const [data, setData] = useState({ schedules: [], exceptions: [], available: false });
  const [scheduleForm, setScheduleForm] = useState(INITIAL_SCHEDULE);
  const [exceptionForm, setExceptionForm] = useState({ scheduleId: "", occurrenceDate: "", kind: "cancelled", name: "", startTime: "", formatName: "", description: "", registrationUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const payload = await loadManagedCommunitySchedules();
    setData({
      schedules: Array.isArray(payload.schedules) ? payload.schedules : [],
      exceptions: Array.isArray(payload.exceptions) ? payload.exceptions : [],
      available: Boolean(payload.available),
    });
    setExceptionForm((current) => ({
      ...current,
      scheduleId: current.scheduleId || payload.schedules?.[0]?.id || "",
    }));
  }, []);

  useEffect(() => {
    reload()
      .catch((requestError) => setError(requestError.message || "Unable to load schedule administration."))
      .finally(() => setLoading(false));
  }, [reload]);

  const activeSchedules = useMemo(() => data.schedules.filter((schedule) => schedule.active), [data.schedules]);
  const exceptionsBySchedule = useMemo(() => {
    const result = new Map();
    for (const exception of data.exceptions) {
      const rows = result.get(exception.scheduleId) || [];
      rows.push(exception);
      result.set(exception.scheduleId, rows);
    }
    return result;
  }, [data.exceptions]);

  async function submitSchedule(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createCommunitySchedule({ ...scheduleForm, weekday: Number(scheduleForm.weekday) });
      setScheduleForm(INITIAL_SCHEDULE);
      await reload();
      setNotice("Weekly schedule saved. It now fills each matching date in the public calendar.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save the weekly schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function submitException(event) {
    event.preventDefault();
    if (!exceptionForm.scheduleId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createCommunityScheduleException(exceptionForm.scheduleId, exceptionForm);
      setExceptionForm((current) => ({ ...current, occurrenceDate: "", name: "", startTime: "", formatName: "", description: "", registrationUrl: "" }));
      await reload();
      setNotice("Calendar exception saved.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save the exception.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSchedule(schedule) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await setCommunityScheduleActive(schedule.id, !schedule.active);
      await reload();
      setNotice(schedule.active ? "Schedule paused; no future dates will be shown." : "Schedule reactivated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update the schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function removeException(scheduleId, exceptionId) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await deleteCommunityScheduleException(scheduleId, exceptionId);
      await reload();
      setNotice("Calendar exception removed.");
    } catch (requestError) {
      setError(requestError.message || "Unable to remove the exception.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TacticalPageShell className="schedule-manager-page">
      <CommunityNav active="venues" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="Community / private editor"
        title="Store schedule manager"
        subtitle="Add one weekly schedule and the public store calendar automatically renders every matching date. Use exceptions for holidays, cancellations, and altered sessions."
        actions={<button type="button" className="venue-manage-button" onClick={() => onNavigate("venues")}>View public calendar</button>}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Active weeklies" value={activeSchedules.length} tone="green" />
        <TacticalSummaryCard label="Paused schedules" value={data.schedules.length - activeSchedules.length} />
        <TacticalSummaryCard label="Date exceptions" value={data.exceptions.length} tone="gold" />
        <TacticalSummaryCard label="Storage" value={data.available ? "ONLINE" : "CHECKING"} tone={data.available ? "blue" : "gold"} />
      </TacticalSummaryStrip>

      {notice ? <p className="schedule-manager-notice is-success" role="status">{notice}</p> : null}
      {error ? <p className="schedule-manager-notice is-error" role="alert">{error}</p> : null}

      <div className="schedule-manager-grid">
        <TacticalDataPanel title="Add weekly store event" subtitle="This is a community-maintained schedule, not imported data from BANDAI TCG+." className="schedule-editor-panel">
          <form className="schedule-form" onSubmit={submitSchedule}>
            <label>Store name<input required value={scheduleForm.venueName} onChange={(event) => setScheduleForm({ ...scheduleForm, venueName: event.target.value })} placeholder="Example: Moki Toys" /></label>
            <label>Event name<input required value={scheduleForm.name} onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} /></label>
            <label>Weekday<select required value={scheduleForm.weekday} onChange={(event) => setScheduleForm({ ...scheduleForm, weekday: event.target.value })}><option value="">Choose a day</option>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label>Start time<input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} /></label>
            <label>Format<input value={scheduleForm.formatName} onChange={(event) => setScheduleForm({ ...scheduleForm, formatName: event.target.value })} placeholder="Standard, casual, draft..." /></label>
            <label>Entry fee<input value={scheduleForm.entryFeeText} onChange={(event) => setScheduleForm({ ...scheduleForm, entryFeeText: event.target.value })} placeholder="Example: R$ 30" /></label>
            <label>City<input value={scheduleForm.city} onChange={(event) => setScheduleForm({ ...scheduleForm, city: event.target.value })} /></label>
            <label>State / region<input value={scheduleForm.region} onChange={(event) => setScheduleForm({ ...scheduleForm, region: event.target.value })} /></label>
            <label>Country<input value={scheduleForm.country} onChange={(event) => setScheduleForm({ ...scheduleForm, country: event.target.value })} /></label>
            <label>Timezone<input value={scheduleForm.timeZone} onChange={(event) => setScheduleForm({ ...scheduleForm, timeZone: event.target.value })} /></label>
            <label>Starts on<input type="date" value={scheduleForm.startDate} onChange={(event) => setScheduleForm({ ...scheduleForm, startDate: event.target.value })} /></label>
            <label>Ends on <small>(optional)</small><input type="date" value={scheduleForm.endDate} onChange={(event) => setScheduleForm({ ...scheduleForm, endDate: event.target.value })} /></label>
            <label className="schedule-form__wide">Store website <small>(optional)</small><input type="url" value={scheduleForm.websiteUrl} onChange={(event) => setScheduleForm({ ...scheduleForm, websiteUrl: event.target.value })} placeholder="https://..." /></label>
            <label className="schedule-form__wide">Registration link <small>(optional)</small><input type="url" value={scheduleForm.registrationUrl} onChange={(event) => setScheduleForm({ ...scheduleForm, registrationUrl: event.target.value })} placeholder="https://..." /></label>
            <label className="schedule-form__wide">Notes <small>(optional)</small><textarea rows="3" value={scheduleForm.description} onChange={(event) => setScheduleForm({ ...scheduleForm, description: event.target.value })} placeholder="How to join, deck rules, anything players should know." /></label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save weekly schedule"}</button>
          </form>
        </TacticalDataPanel>

        <TacticalDataPanel title="Add calendar exception" subtitle="A cancellation hides that one recurrence. An override keeps the date but replaces its details." className="schedule-editor-panel">
          <form className="schedule-form" onSubmit={submitException}>
            <label className="schedule-form__wide">Weekly schedule<select required value={exceptionForm.scheduleId} onChange={(event) => setExceptionForm({ ...exceptionForm, scheduleId: event.target.value })}><option value="">Choose a schedule</option>{data.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.venueName} — {schedule.name}</option>)}</select></label>
            <label>Date<input required type="date" value={exceptionForm.occurrenceDate} onChange={(event) => setExceptionForm({ ...exceptionForm, occurrenceDate: event.target.value })} /></label>
            <label>Type<select value={exceptionForm.kind} onChange={(event) => setExceptionForm({ ...exceptionForm, kind: event.target.value })}><option value="cancelled">Cancelled</option><option value="override">Changed session</option></select></label>
            {exceptionForm.kind === "override" ? <>
              <label>Replacement event name<input value={exceptionForm.name} onChange={(event) => setExceptionForm({ ...exceptionForm, name: event.target.value })} /></label>
              <label>Replacement time<input type="time" value={exceptionForm.startTime} onChange={(event) => setExceptionForm({ ...exceptionForm, startTime: event.target.value })} /></label>
              <label>Replacement format<input value={exceptionForm.formatName} onChange={(event) => setExceptionForm({ ...exceptionForm, formatName: event.target.value })} /></label>
              <label className="schedule-form__wide">Replacement registration link<input type="url" value={exceptionForm.registrationUrl} onChange={(event) => setExceptionForm({ ...exceptionForm, registrationUrl: event.target.value })} placeholder="https://..." /></label>
              <label className="schedule-form__wide">What changed?<textarea rows="3" value={exceptionForm.description} onChange={(event) => setExceptionForm({ ...exceptionForm, description: event.target.value })} /></label>
            </> : null}
            <button type="submit" disabled={saving || !exceptionForm.scheduleId}>{saving ? "Saving..." : "Save exception"}</button>
          </form>
        </TacticalDataPanel>
      </div>

      <TacticalDataPanel title="Registered schedules" subtitle="Pause an entry instead of deleting it; its history and recorded exceptions stay intact." className="schedule-list-panel">
        {loading ? <p className="schedule-empty">Loading schedule administration...</p> : null}
        {!loading && !data.schedules.length ? <p className="schedule-empty">No weekly store schedule has been added yet.</p> : null}
        <div className="schedule-list">
          {data.schedules.map((schedule) => (
            <article key={schedule.id} className={schedule.active ? "" : "is-paused"}>
              <header>
                <div><span>{schedule.active ? "ACTIVE" : "PAUSED"}</span><h2>{schedule.venueName}</h2><p>{schedule.name} · {WEEKDAYS[schedule.weekday]}{schedule.startTime ? ` · ${schedule.startTime}` : ""}{schedule.formatName ? ` · ${schedule.formatName}` : ""}</p></div>
                <button type="button" onClick={() => toggleSchedule(schedule)} disabled={saving}>{schedule.active ? "Pause" : "Reactivate"}</button>
              </header>
              <p className="schedule-list__location">{[schedule.city, schedule.region, schedule.country].filter(Boolean).join(" · ") || "Location pending"}</p>
              <div className="schedule-exceptions">
                {(exceptionsBySchedule.get(schedule.id) || []).map((exception) => (
                  <span key={exception.id} className={exception.kind === "cancelled" ? "is-cancelled" : "is-override"}>
                    <b>{exception.occurrenceDate}</b> {exception.kind === "cancelled" ? "cancelled" : `changed${exception.name ? `: ${exception.name}` : ""}`}
                    <button type="button" onClick={() => removeException(schedule.id, exception.id)} disabled={saving} aria-label={`Remove exception on ${exception.occurrenceDate}`}>×</button>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </TacticalDataPanel>
    </TacticalPageShell>
  );
}
