import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events?type=public')
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
      <h1>Public Sauna Sessions</h1>
      <p style={{ marginBottom: 24, color: '#aaa' }}>
        Book a public sauna session. <Link to="/private" style={{ color: '#f59e0b' }}>Looking for a private session?</Link>
      </p>
      {events.length === 0 ? (
        <p style={{ color: '#aaa' }}>No public events available right now. Check back soon!</p>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div key={event._id} className="event-card">
              <h3>{event.name}</h3>
              <p className="date">{formatDate(event.date)}</p>
              <p>Capacity: {event.max_capacity}</p>
              <p className="price">${event.price}</p>
              {event.booked ? (
                <span className="booked-tag">Fully Booked</span>
              ) : (
                <Link to={`/book/${event._id}`}>
                  <button className="btn btn-primary" style={{ marginTop: 12 }}>Book Now</button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
