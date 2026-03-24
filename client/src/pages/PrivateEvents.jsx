import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function PrivateEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events?type=private')
      .then(res => setEvents(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <p>Loading events...</p>;

  return (
    <div>
      <h1>Private Sauna Sessions</h1>
      <p style={{ marginBottom: 24, color: '#aaa' }}>
        Book an exclusive private sauna session for you and your group.
      </p>
      {events.length === 0 ? (
        <p style={{ color: '#aaa' }}>No private events available right now. Check back soon!</p>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div key={event._id} className="event-card">
              <h3>{event.name}</h3>
              <p className="date">{formatDate(event.date)}</p>
              <p>Max Capacity: {event.max_capacity}</p>
              <p className="price">${event.price}</p>
              <span className="badge badge-private" style={{ marginBottom: 12 }}>Private</span>
              {event.booked ? (
                <span className="booked-tag" style={{ marginLeft: 8 }}>Fully Booked</span>
              ) : (
                <Link to={`/book/${event._id}`}>
                  <button className="btn btn-primary" style={{ marginTop: 12, display: 'block' }}>Book Now</button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PrivateEvents;
