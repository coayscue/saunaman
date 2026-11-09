const crypto = require('crypto');
function localShape(event) {
  return { name: event.name || '', start: new Date(event.date).toISOString(), end: new Date(+new Date(event.date) + event.duration * 60000).toISOString(), location: event.location?.address || '' };
}
function remoteShape(event) {
  if (event.status === 'cancelled') return null;
  if (!event.start?.dateTime || !event.end?.dateTime || event.recurrence || event.recurringEventId) throw new Error('Linked events must be single timed events, not recurring or all-day');
  const start = new Date(event.start.dateTime), end = new Date(event.end.dateTime);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || end - start > 24 * 3600000) throw new Error('Unsupported event interval');
  return { name: event.summary || '', start: start.toISOString(), end: end.toISOString(), location: event.location || '' };
}
const serialize = shape => JSON.stringify(shape);
const key = value => crypto.createHash('sha256').update(value).digest('hex');
function plan(base, local, remote, force) {
  if (!remote) return 'deleted';
  if (serialize(local) === serialize(remote)) return 'same';
  if (force === 'website') return 'push';
  if (force === 'google') return 'pull';
  if (!base) return 'conflict';
  const localChanged = serialize(local) !== base, remoteChanged = serialize(remote) !== base;
  if (localChanged && remoteChanged) return 'conflict';
  return localChanged ? 'push' : 'pull';
}
function scheduleChanged(a, b) { return a.start !== b.start || a.end !== b.end || a.location !== b.location; }
module.exports = { localShape, remoteShape, serialize, key, plan, scheduleChanged };
