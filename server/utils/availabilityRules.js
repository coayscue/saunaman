const { DateTime } = require('luxon');
const zone = 'America/Los_Angeles';
function validateHours(startMinute, endMinute) {
  if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || endMinute > 1440 || startMinute >= endMinute || startMinute % 60 || endMinute % 60) throw new Error('Choose whole-hour boundaries with end after start');
}
function validateWeekly(weekly) {
  if (!Array.isArray(weekly) || weekly.length > 28) throw new Error('Invalid weekly schedule');
  return weekly.map(({weekday, startMinute, endMinute}) => {
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new Error('Invalid weekday');
    validateHours(startMinute, endMinute);
    return {weekday, startMinute, endMinute};
  });
}
function validateRule(body) {
  const {kind, fromDate, toDate, startMinute, endMinute} = body;
  if (!['available', 'blocked'].includes(kind)) throw new Error('Invalid availability type');
  if (![fromDate, toDate].every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error('Choose valid dates');
  const from = DateTime.fromISO(fromDate, {zone}), to = DateTime.fromISO(toDate, {zone});
  if (!from.isValid || !to.isValid || to < from || to.diff(from, 'days').days > 365) throw new Error('Choose a date range up to one year');
  validateHours(startMinute, endMinute);
  return {kind, fromDate, toDate, startMinute, endMinute};
}
function merge(intervals) {
  const result = [];
  for (const interval of [...intervals].sort((a,b) => a.start - b.start)) {
    const previous = result[result.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else result.push({...interval});
  }
  return result;
}
function intervals(schedule, rules, start, end) {
  const available = [], blocked = [];
  for (let day = DateTime.fromJSDate(start, {zone}).startOf('day'); day.toMillis() < +end; day = day.plus({days:1})) {
    const date = day.toISODate();
    const hours = [...schedule.weekly.filter(row => row.weekday === day.weekday).map(row => ({...row, kind:'available'})), ...rules.filter(rule => !rule.deleted && rule.fromDate <= date && rule.toDate >= date)];
    for (const row of hours) {
      // Wall-clock arithmetic keeps weekly hours stable across daylight saving transitions.
      const at = minutes => minutes === 1440 ? day.plus({days:1}).startOf('day').toMillis() : day.set({hour:minutes/60, minute:0}).toMillis();
      const interval = {start:at(row.startMinute), end:at(row.endMinute)};
      if (interval.end > interval.start) (row.kind === 'blocked' ? blocked : available).push(interval);
    }
  }
  return {available:merge(available), blocked:merge(blocked)};
}
function fits(start, end, available, blocked) {
  return available.some(window => +start >= window.start && +end <= window.end) && !blocked.some(block => +start < block.end && +end > block.start);
}
function slots(schedule, rules, busy, start, end, duration, now = Date.now()) {
  const windows = intervals(schedule, rules, start, new Date(+end + duration * 3600000));
  const blocked = [...windows.blocked, ...busy.map(row => ({start:+new Date(row.date), end:+new Date(row.date) + row.duration * 60000}))];
  const result = [];
  const seen = new Set();
  for (let day = DateTime.fromJSDate(start, {zone}).startOf('day'); +day < +end; day = day.plus({days:1})) {
    for (let hour=0; hour<24; hour++) {
      const begin = day.set({hour}).toMillis(), finish = begin + duration * 3600000;
      if (seen.has(begin)) continue;
      seen.add(begin);
      if (begin >= +start && begin < +end && begin - now >= 36 * 3600000 && fits(begin, finish, windows.available, blocked)) result.push({date:day.toISODate(), start:new Date(begin).toISOString(), end:new Date(finish).toISOString()});
    }
  }
  return result;
}
module.exports = {zone, validateWeekly, validateRule, intervals, fits, slots};
