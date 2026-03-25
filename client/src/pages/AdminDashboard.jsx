import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api';

const localizer = momentLocalizer(moment);

function AdminDashboard() {
  const [tab, setTab] = useState('agenda');
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [donations, setDonations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedEventReservations, setSelectedEventReservations] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '', date: '', price: '', max_capacity: '', type: 'public', duration: 90
  });

  const loadData = useCallback(async () => {
    try {
      const [eventsRes, usersRes, reservationsRes, donationsRes] = await Promise.all([
        api.get('/events'),
        api.get('/users'),
        api.get('/reservations'),
        api.get('/donations')
      ]);
      setEvents(eventsRes.data);
      setUsers(usersRes.data);
      setReservations(reservationsRes.data);
      setDonations(donationsRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const calendarEvents = events.map(e => ({
    id: e._id,
    title: `${e.name} (${e.type})`,
    start: new Date(e.date),
    end: new Date(new Date(e.date).getTime() + (e.duration || 90) * 60 * 1000),
    resource: e
  }));

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/events', {
        ...newEvent,
        date: new Date(newEvent.date).toISOString(),
        price: parseFloat(newEvent.price),
        max_capacity: parseInt(newEvent.max_capacity),
        duration: parseInt(newEvent.duration)
      });
      setShowCreateEvent(false);
      setNewEvent({ name: '', date: '', price: '', max_capacity: '', type: 'public' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating event');
    }
  };

  const handleSelectSlot = ({ start }) => {
    setNewEvent(prev => ({
      ...prev,
      date: moment(start).format('YYYY-MM-DDTHH:mm')
    }));
    setShowCreateEvent(true);
  };

  const handleSelectEvent = (calEvent) => {
    const event = calEvent.resource;
    setSelectedEvent(event);
    // Find reservations for this event
    const eventReservations = reservations.filter(r => r.event?._id === event._id && !r.cancelled);
    setSelectedEventReservations(eventReservations);
  };

  const handleEditEvent = () => {
    setEditingEvent({
      name: selectedEvent.name,
      date: moment(selectedEvent.date).format('YYYY-MM-DDTHH:mm'),
      price: selectedEvent.price,
      max_capacity: selectedEvent.max_capacity,
      duration: selectedEvent.duration || 90,
      type: selectedEvent.type
    });
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.put(`/events/${selectedEvent._id}`, {
        ...editingEvent,
        date: new Date(editingEvent.date).toISOString(),
        price: parseFloat(editingEvent.price),
        max_capacity: parseInt(editingEvent.max_capacity),
        duration: parseInt(editingEvent.duration)
      });
      setSelectedEvent(updated.data);
      setEditingEvent(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      setSelectedEvent(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error deleting event');
    }
  };

  const handleUserClick = async (userId) => {
    try {
      const res = await api.get(`/users/${userId}`);
      setSelectedUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReservationClick = async (reservationId) => {
    try {
      const res = await api.get(`/reservations/${reservationId}`);
      setSelectedReservation(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'agenda' ? 'active' : ''}`} onClick={() => setTab('agenda')}>
          Agenda
        </button>
        <button className={`admin-tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          Calendar
        </button>
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Users ({users.length})
        </button>
        <button className={`admin-tab ${tab === 'reservations' ? 'active' : ''}`} onClick={() => setTab('reservations')}>
          Reservations ({reservations.length})
        </button>
        <button className={`admin-tab ${tab === 'donations' ? 'active' : ''}`} onClick={() => setTab('donations')}>
          Donations ({donations.length})
        </button>
      </div>

      {/* AGENDA TAB */}
      {tab === 'agenda' && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowCreateEvent(true)}>
            + Create Event
          </button>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', color: '#BA160C' }}>Date</th>
                <th style={{ padding: '10px 12px', color: '#BA160C' }}>Time</th>
                <th style={{ padding: '10px 12px', color: '#BA160C' }}>Event</th>
                <th style={{ padding: '10px 12px', color: '#BA160C' }}>Type</th>
                <th style={{ padding: '10px 12px', color: '#BA160C', textAlign: 'center' }}>Capacity</th>
                <th style={{ padding: '10px 12px', color: '#BA160C', textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>No events</td></tr>
              ) : (
                events.map(e => {
                  const activeCount = reservations.filter(r => r.event?._id === e._id && !r.cancelled).length;
                  return (
                    <tr
                      key={e._id}
                      onClick={() => {
                        setSelectedEvent(e);
                        setSelectedEventReservations(reservations.filter(r => r.event?._id === e._id && !r.cancelled));
                      }}
                      style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={ev => ev.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '10px 12px' }}>{moment(e.date).format('MMM D, YYYY')}</td>
                      <td style={{ padding: '10px 12px' }}>{moment(e.date).format('h:mm A')}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{e.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${e.type === 'public' ? 'badge-public' : 'badge-private'}`}>{e.type}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: activeCount >= e.max_capacity ? '#dc2626' : '#6b7280' }}>
                        {activeCount}/{e.max_capacity}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                        ${e.price}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CALENDAR TAB */}
      {tab === 'calendar' && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowCreateEvent(true)}>
            + Create Event
          </button>
          <div style={{ height: 600 }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onDoubleClickEvent={handleSelectEvent}
              components={{
                month: {
                  event: ({ event }) => (
                    <span>
                      <strong>{moment(event.start).format('h:mm A')}</strong> {event.title}
                    </span>
                  )
                }
              }}
              style={{ height: '100%' }}
            />
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <ul className="admin-list">
          {users.map(user => (
            <li key={user._id} onClick={() => handleUserClick(user._id)}>
              <div>
                <strong>{user.name}</strong>
                <span style={{ color: '#6b7280', marginLeft: 12 }}>{user.email}</span>
              </div>
              <div>
                <span className="badge badge-active">{user.credits} credits</span>
              </div>
            </li>
          ))}
          {users.length === 0 && <p style={{ color: '#6b7280', padding: 16 }}>No users yet</p>}
        </ul>
      )}

      {/* RESERVATIONS TAB */}
      {tab === 'reservations' && (
        <ul className="admin-list">
          {reservations.map(res => (
            <li key={res._id} onClick={() => handleReservationClick(res._id)}>
              <div>
                <strong>{res.event?.name || 'Unknown Event'}</strong>
                <span style={{ color: '#6b7280', marginLeft: 12 }}>{res.user?.name || 'Unknown User'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge ${res.event?.type === 'public' ? 'badge-public' : 'badge-private'}`}>
                  {res.event?.type}
                </span>
                <span className={`badge ${res.cancelled ? 'badge-cancelled' : 'badge-active'}`}>
                  {res.cancelled ? 'Cancelled' : 'Active'}
                </span>
              </div>
            </li>
          ))}
          {reservations.length === 0 && <p style={{ color: '#6b7280', padding: 16 }}>No reservations yet</p>}
        </ul>
      )}

      {/* DONATIONS TAB */}
      {tab === 'donations' && (
        <ul className="admin-list">
          {donations.map(d => (
            <li key={d._id} onClick={() => d.user && handleUserClick(d.user._id)} style={{ cursor: d.user ? 'pointer' : 'default' }}>
              <div>
                <strong style={{ color: '#059669' }}>${d.amount}</strong>
                <span style={{ color: '#6b7280', marginLeft: 12 }}>{d.user?.name || 'Unknown'}</span>
                <span style={{ color: '#9ca3af', marginLeft: 8 }}>{d.user?.email}</span>
              </div>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{formatDate(d.date)}</span>
            </li>
          ))}
          {donations.length === 0 && <p style={{ color: '#6b7280', padding: 16 }}>No donations yet</p>}
        </ul>
      )}

      {/* CREATE EVENT MODAL */}
      {showCreateEvent && (
        <div className="modal-overlay" onClick={() => setShowCreateEvent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCreateEvent(false)}>×</button>
            <h2>Create Event</h2>
            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label>Event Name</label>
                <input type="text" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Date & Time</label>
                <input type="datetime-local" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={newEvent.duration} onChange={e => setNewEvent({ ...newEvent, duration: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input type="number" step="0.01" value={newEvent.price} onChange={e => setNewEvent({ ...newEvent, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Max Capacity</label>
                <input type="number" value={newEvent.max_capacity} onChange={e => setNewEvent({ ...newEvent, max_capacity: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Event</button>
            </form>
          </div>
        </div>
      )}

      {/* EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => { setSelectedEvent(null); setEditingEvent(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setSelectedEvent(null); setEditingEvent(null); }}>×</button>
            <h2>Event Details</h2>

            {editingEvent ? (
              <form onSubmit={handleSaveEvent}>
                <div className="form-group">
                  <label>Event Name</label>
                  <input type="text" value={editingEvent.name} onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date & Time</label>
                  <input type="datetime-local" value={editingEvent.date} onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input type="number" value={editingEvent.duration} onChange={e => setEditingEvent({ ...editingEvent, duration: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input type="number" step="0.01" value={editingEvent.price} onChange={e => setEditingEvent({ ...editingEvent, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Max Capacity</label>
                  <input type="number" value={editingEvent.max_capacity} onChange={e => setEditingEvent({ ...editingEvent, max_capacity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={editingEvent.type} onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingEvent(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{selectedEvent.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">{formatDate(selectedEvent.date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Duration</span>
                  <span className="detail-value">{selectedEvent.duration || 90} min</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span className={`badge ${selectedEvent.type === 'public' ? 'badge-public' : 'badge-private'}`}>
                    {selectedEvent.type}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Price</span>
                  <span className="detail-value">${selectedEvent.price}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Active Reservations</span>
                  <span className="detail-value">{selectedEventReservations.length}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Max Capacity</span>
                  <span className="detail-value">{selectedEvent.max_capacity}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span className={`badge ${selectedEvent.booked ? 'badge-cancelled' : 'badge-active'}`}>
                    {selectedEvent.booked ? 'Booked' : 'Available'}
                  </span>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleEditEvent}>
                  Edit Event
                </button>

                {selectedEventReservations.length > 0 && (
                  <>
                    <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>Registrants</h3>
                    <ul className="admin-list">
                      {selectedEventReservations.map(res => (
                        <li key={res._id} style={{ cursor: 'default' }}>
                          <div>
                            <strong>{res.user?.name || 'Unknown'}</strong>
                            <span style={{ color: '#6b7280', marginLeft: 8 }}>{res.user?.email}</span>
                          </div>
                          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{formatDate(res.date_created)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {selectedEventReservations.length === 0 && (
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => handleDeleteEvent(selectedEvent._id)}
                  >
                    Delete Event
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* USER DETAIL MODAL */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUser(null)}>×</button>
            <h2>User Details</h2>
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{selectedUser.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{selectedUser.email}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Credits</span>
              <span className="detail-value">{selectedUser.credits}</span>
            </div>
            <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>Reservations</h3>
            {selectedUser.reservations?.length > 0 ? (
              <ul className="admin-list">
                {selectedUser.reservations.map(res => (
                  <li key={res._id} onClick={() => { setSelectedUser(null); handleReservationClick(res._id); }}>
                    <div>
                      <strong>{res.event?.name || 'Unknown'}</strong>
                      <span style={{ color: '#6b7280', marginLeft: 8 }}>{formatDate(res.date_created)}</span>
                    </div>
                    <span className={`badge ${res.cancelled ? 'badge-cancelled' : 'badge-active'}`}>
                      {res.cancelled ? 'Cancelled' : 'Active'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#6b7280' }}>No reservations</p>
            )}
            <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>Donations</h3>
            {selectedUser.donations?.length > 0 ? (
              <ul className="admin-list">
                {selectedUser.donations.map(d => (
                  <li key={d._id} style={{ cursor: 'default' }}>
                    <div>
                      <strong style={{ color: '#059669' }}>${d.amount}</strong>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{formatDate(d.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#6b7280' }}>No donations</p>
            )}
          </div>
        </div>
      )}

      {/* RESERVATION DETAIL MODAL */}
      {selectedReservation && (
        <div className="modal-overlay" onClick={() => setSelectedReservation(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedReservation(null)}>×</button>
            <h2>Reservation Details</h2>
            <div className="detail-row">
              <span className="detail-label">Date Created</span>
              <span className="detail-value">{formatDate(selectedReservation.date_created)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className={`badge ${selectedReservation.cancelled ? 'badge-cancelled' : 'badge-active'}`}>
                {selectedReservation.cancelled ? 'Cancelled' : 'Active'}
              </span>
            </div>
            <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>Event</h3>
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{selectedReservation.event?.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date</span>
              <span className="detail-value">{formatDate(selectedReservation.event?.date)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type</span>
              <span className={`badge ${selectedReservation.event?.type === 'public' ? 'badge-public' : 'badge-private'}`}>
                {selectedReservation.event?.type}
              </span>
            </div>
            <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>User</h3>
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{selectedReservation.user?.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{selectedReservation.user?.email}</span>
            </div>
            <h3 style={{ color: '#BA160C', marginTop: 20, marginBottom: 12 }}>Payment</h3>
            {selectedReservation.payment ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">Amount</span>
                  <span className="detail-value">${selectedReservation.payment.amount}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">{formatDate(selectedReservation.payment.date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Stripe ID</span>
                  <span className="detail-value" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    {selectedReservation.payment.stripe_payment_id}
                  </span>
                </div>
              </>
            ) : (
              <p style={{ color: '#6b7280' }}>No payment record</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
