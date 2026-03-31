import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

function LeaveReview() {
  const { reservationId } = useParams();
  const [reservation, setReservation] = useState(null);
  const [hasReview, setHasReview] = useState(false);
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/reviews/reservation/${reservationId}`),
      api.get(`/reviews/check/${reservationId}`)
    ])
      .then(([resData, checkData]) => {
        setReservation(resData.data);
        setHasReview(checkData.data.hasReview);
        if (resData.data.user) {
          setName(resData.data.user.name || '');
        }
      })
      .catch(() => setError('Reservation not found'))
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - photos.length);
    const newPhotos = [...photos, ...files].slice(0, 5);
    setPhotos(newPhotos);

    // Generate previews
    const newPreviews = [];
    newPhotos.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newPreviews.push(ev.target.result);
        if (newPreviews.length === newPhotos.length) {
          setPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (newPhotos.length === 0) setPreviews([]);
  };

  const removePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stars || !name) {
      setError('Please provide a star rating and your name');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('reservationId', reservationId);
      formData.append('stars', stars);
      formData.append('text', text);
      formData.append('name', name);
      photos.forEach(photo => formData.append('photos', photo));

      await api.post('/reviews', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="booking-container"><p>Loading...</p></div>;

  if (error && !reservation) {
    return (
      <div className="booking-container">
        <p style={{ color: '#dc2626' }}>{error}</p>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
          Back Home
        </Link>
      </div>
    );
  }

  if (hasReview) {
    return (
      <div className="booking-container">
        <div className="success-message">
          <h2>Thank You!</h2>
          <p style={{ marginTop: 16, color: '#6b7280' }}>
            You've already submitted a review for this event. We appreciate your feedback!
          </p>
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 24, textDecoration: 'none' }}>
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="booking-container">
        <div className="success-message">
          <h2>Review Submitted!</h2>
          <p style={{ marginTop: 16, color: '#6b7280' }}>
            Thank you for sharing your experience. Your review helps others discover Sauna Man!
          </p>
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 24, textDecoration: 'none' }}>
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = reservation?.event ? new Date(reservation.event.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }) : '';

  return (
    <div className="booking-container">
      <Link to="/" style={{ textDecoration: 'none', color: '#BA160C', display: 'inline-block', marginBottom: 16, fontSize: '1.1rem' }}>&larr; Back Home</Link>

      <h1>How Was Your Experience?</h1>
      {reservation?.event && (
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          {reservation.event.name} &mdash; {eventDate}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Star Rating */}
        <div className="form-group">
          <label>Rating</label>
          <div className="star-rating-input">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                type="button"
                key={s}
                className={`star-btn ${s <= (hoverStars || stars) ? 'filled' : ''}`}
                onClick={() => setStars(s)}
                onMouseEnter={() => setHoverStars(s)}
                onMouseLeave={() => setHoverStars(0)}
              >
                {s <= (hoverStars || stars) ? '★' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="form-group">
          <label>Your Name (displayed publicly)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John D."
            required
          />
        </div>

        {/* Text Review */}
        <div className="form-group">
          <label>Your Review (optional)</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Photo Upload */}
        <div className="form-group">
          <label>Upload Photos (up to 5)</label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= 5}
          >
            {photos.length >= 5 ? 'Max photos reached' : `Add Photos (${photos.length}/5)`}
          </button>

          {previews.length > 0 && (
            <div className="photo-previews">
              {previews.map((src, i) => (
                <div key={i} className="photo-preview">
                  <img src={src} alt={`Upload ${i + 1}`} />
                  <button type="button" className="photo-remove" onClick={() => removePhoto(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px 24px', fontSize: '1.1rem' }}
          disabled={submitting || !stars || !name}
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}

export default LeaveReview;
