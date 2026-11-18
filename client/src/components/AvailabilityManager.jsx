import React, { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import api from '../api';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function hourLabel(minute) {
  if (minute === 1440) return 'Midnight (end of day)';
  const hour = minute / 60;
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
}
function HourSelect({ value, onChange, end = false, label }) {
  return <label>{label} <select value={value} onChange={event => onChange(Number(event.target.value))}>
    {Array.from({ length: 24 }, (_, index) => (index + (end ? 1 : 0)) * 60).map(minute => <option key={minute} value={minute}>{hourLabel(minute)}</option>)}
  </select></label>;
}
function newWindow() {
  const today = DateTime.now().setZone('America/Los_Angeles').toISODate();
  return { kind: 'available', fromDate: today, toDate: today, startMinute: 540, endMinute: 1020 };
}
function availabilityError(error, fallback) {
  if (error.response?.status === 404) return 'The running backend is missing the availability API. Deploy the latest backend, then reload saved availability.';
  if ([401, 403].includes(error.response?.status)) return 'Your admin session expired. Refresh the page and sign in again.';
  if (!error.response) return 'Unable to reach the availability server. Check the backend and your connection, then retry.';
  return error.response.data?.error || fallback;
}
export default function AvailabilityManager() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [windows, setWindows] = useState([]);
  const [syncErrors, setSyncErrors] = useState([]);
  const [draft, setDraft] = useState(newWindow);
  const [editing, setEditing] = useState(null);
  const [allDay, setAllDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function refresh() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/availability');
      if (!data.schedule || !Array.isArray(data.schedule.weekly)) throw new Error('Invalid availability response');
      setSchedule(data.schedule);
      setWindows(data.rules);
      setSyncErrors(data.syncErrors);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh().catch(error => setError(availabilityError(error, 'Unable to load availability. Please retry.')));
  }, []);
  async function perform(action, success) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); setMessage(success); }
    catch (failure) { setError(availabilityError(failure, 'Unable to save availability')); }
    finally { setBusy(false); }
  }
  function changeWeekly(index, field, value) {
    setSchedule(previous => ({ ...previous, weekly: previous.weekly.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) }));
  }
  function resetWindow() { setDraft(newWindow()); setEditing(null); setAllDay(false); }
  async function saveWindow(event) {
    event.preventDefault();
    const values = { ...draft, ...(draft.kind === 'blocked' && allDay ? { startMinute: 0, endMinute: 1440 } : {}) };
    await perform(async () => {
      if (editing) await api.put(`/admin/availability/rules/${editing}`, values);
      else await api.post('/admin/availability/rules', values);
      resetWindow();
    }, 'Availability saved. Customers see the updated hours when availability refreshes.');
  }
  return <section style={{ border: '1px solid #aaa', padding: 20, margin: '20px 0' }}>
    <h2>Booking availability</h2>
    <p>Manage private booking hours here. All times are San Francisco time. Busy Google events, confirmed bookings and pending holds take priority.</p>
    <p>Changes apply to website availability immediately. Google Calendar receives a mirror on the next synchronization. Edit these availability windows here.</p>
    <button type="button" className="btn" disabled={busy} onClick={() => perform(async () => {}, 'Saved availability reloaded.')}>Reload saved availability</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {syncErrors.length > 0 && <p role="status">{syncErrors[0]}</p>}
    {!schedule ? <p>{loading ? 'Loading schedule…' : 'Schedule could not be loaded. Use Reload saved availability to retry.'}</p> : <>
      <form onSubmit={event => { event.preventDefault(); perform(() => api.put('/admin/availability/weekly', { weekly: schedule.weekly, revision: schedule.revision }), 'Weekly schedule saved.'); }}>
        <h3>Recurring weekly hours</h3>
        <p>Remove a day's hours to close that weekday. Add extra windows below for specific dates.</p>
        {schedule.weekly.map((row, index) => <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
          <label>Day <select value={row.weekday} onChange={event => changeWeekly(index, 'weekday', Number(event.target.value))}>{weekdays.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}</option>)}</select></label>
          <HourSelect label="From" value={row.startMinute} onChange={value => changeWeekly(index, 'startMinute', value)} />
          <HourSelect label="Until" end value={row.endMinute} onChange={value => changeWeekly(index, 'endMinute', value)} />
          <button type="button" disabled={busy} onClick={() => setSchedule(previous => ({ ...previous, weekly: previous.weekly.filter((_, rowIndex) => rowIndex !== index) }))}>Remove hours</button>
        </div>)}
        <button type="button" disabled={busy || schedule.weekly.length >= 28} onClick={() => setSchedule(previous => ({ ...previous, weekly: [...previous.weekly, { weekday: 1, startMinute: 540, endMinute: 1020 }] }))}>Add weekly hours</button>{' '}
        <button type="submit" className="btn btn-primary" disabled={busy}>Save weekly schedule</button>
      </form>
      <form onSubmit={saveWindow}>
        <h3>{editing ? 'Edit availability window' : 'Add available hours or block time'}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label>Action <select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}><option value="available">Add available hours</option><option value="blocked">Block time</option></select></label>
          <label>First date <input type="date" required value={draft.fromDate} onChange={event => setDraft({ ...draft, fromDate: event.target.value, toDate: draft.toDate < event.target.value ? event.target.value : draft.toDate })} /></label>
          <label>Last date <input type="date" required min={draft.fromDate} value={draft.toDate} onChange={event => setDraft({ ...draft, toDate: event.target.value })} /></label>
          {draft.kind === 'blocked' && <label><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)} /> Entire day</label>}
          {!(draft.kind === 'blocked' && allDay) && <>
            <HourSelect label="From" value={draft.startMinute} onChange={value => setDraft({ ...draft, startMinute: value })} />
            <HourSelect label="Until" end value={draft.endMinute} onChange={value => setDraft({ ...draft, endMinute: value })} />
          </>}
        </div>
        <p>The chosen hours apply each day in the date range. Blocks override added hours.</p>
        <button className="btn btn-primary" disabled={busy || !schedule} type="submit">{editing ? 'Save window' : 'Add window'}</button>{' '}
        {editing && <button type="button" onClick={resetWindow}>Cancel edit</button>}
      </form>
      <h3>Date-specific windows</h3>
      {!windows.length && <p>No date-specific windows.</p>}
      {windows.map(window => <div key={window._id} style={{ padding: '10px 0', borderBottom: '1px solid #ccc' }}>
        <strong>{window.kind === 'blocked' ? 'Unavailable' : 'Available'}</strong>{' '}
        {window.fromDate} through {window.toDate}, {hourLabel(window.startMinute)}–{hourLabel(window.endMinute)}{' '}
        <button type="button" disabled={busy} onClick={() => { setEditing(window._id); setDraft(window); setAllDay(window.startMinute === 0 && window.endMinute === 1440); }}>Edit</button>{' '}
        <button type="button" disabled={busy} onClick={() => {
          if (globalThis.confirm('Remove this availability window? Existing confirmed bookings stay booked.')) perform(() => api.delete(`/admin/availability/rules/${window._id}`), 'Window removed.');
        }}>Remove window</button>
      </div>)}
    </>}
  </section>;
}
