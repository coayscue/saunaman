import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import logo from '../images/sauna_man_logo.png';
import igLogo from '../images/ig_logo.webp';
import PhotoCollage from '../components/PhotoCollage';

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
      <img src={logo} alt="Sauna Man" style={{ maxWidth: 300, display: 'block', margin: '0 auto 16px' }} />
      <PhotoCollage />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <a href="https://www.instagram.com/saunamansf/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', color: '#BA160C', border: '2px solid #BA160C' }}>
            <img src={igLogo} alt="Instagram" width="28" height="28" style={{ borderRadius: 4 }} />
            Follow Us
          </button>
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Link to="/private" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: '#ffffff', color: '#BA160C', border: '2px solid #BA160C', display: 'flex', alignItems: 'center', gap: 10 }}><span>🎉</span><span>Book a Private Event</span></button>
          </Link>
          <Link to="/donate" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: '#ffffff', color: '#BA160C', border: '2px solid #BA160C', display: 'flex', alignItems: 'center', gap: 10 }}><span>🤝</span><span>Donate</span></button>
          </Link>
          <Link to="/waiver" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: '#ffffff', color: '#BA160C', border: '2px solid #BA160C', display: 'flex', alignItems: 'center', gap: 10 }}><span>📄</span><span>Sign Waiver</span></button>
          </Link>
        </div>
      </div>
      <h1>Sauna & Plunge Events</h1>
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
