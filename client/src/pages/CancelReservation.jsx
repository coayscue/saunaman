import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

function CancelReservation() {
  const { reservationId } = useParams();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/reservations/${reservationId}`)
      .then(res => {
        setReservation(res.data);
        if (res.data.cancelled) setCancelled(true);
      })
      .catch(() => setError('Reservation not found'))
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/reservations/${reservationId}/cancel`);
      setCancelled(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cancelling reservation');
    }
    setCancelling(false);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: '#dc2626' }}>{error}</p>;
  if (!reservation) return <p>Reservation not found</p>;

  const event = reservation.event;

  return (
    <div className="booking-container">
      <h1>Cancel Reservation</h1>

      <div style={{ background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: '#BA160C', marginBottom: 12 }}>{event.name}</h3>
        <p style={{ color: '#60a5fa' }}>
          {new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
          {event.endDate && ` – ${new Date(event.endDate).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}`}
        </p>
        <p style={{ color: '#aaa', marginTop: 8 }}>Type: {event.type === 'public' ? 'Public Session' : 'Private Session'}</p>
      </div>

      {cancelled ? (
        <div className="success-message">
          <h2 style={{ color: '#dc2626' }}>Reservation Cancelled</h2>
          <p style={{ marginTop: 16, color: '#aaa' }}>
            {event.type === 'private'
              ? 'A 75% refund has been issued to your original payment method.'
              : 'A credit has been added to your account for future use.'}
          </p>
        </div>
      ) : (
        <div>
          <div style={{ background: '#1a1a2e', border: '1px solid #BA160C', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: 8 }}>Cancellation Policy</p>
            {event.type === 'private' ? (
              <p style={{ color: '#aaa' }}>Private event cancellations receive a <strong style={{ color: '#e0e0e0' }}>75% refund</strong> to your original payment method.</p>
            ) : (
              <p style={{ color: '#aaa' }}>Public event cancellations receive a <strong style={{ color: '#e0e0e0' }}>credit</strong> on your account for future use.</p>
            )}
          </div>
          <button
            className="btn btn-danger"
            style={{ width: '100%' }}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CancelReservation;
