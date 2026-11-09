import { DateTime } from 'luxon';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StripePaymentForm from '../components/StripePaymentForm';
import LocationPicker from '../components/LocationPicker';
import api from '../api';
import PhotoCollage from '../components/PhotoCollage';
import LiabilityWaiver from '../components/LiabilityWaiver';


const UPLOADS_BASE = import.meta.env.PROD
  ? 'https://api.saunaman-sf.com'
  : 'http://localhost:5001';

const TENT_OPTIONS = [
  { count: 1, capacity: 12, price: 450 },
  { count: 2, capacity: 24, price: 700 },
];


function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    api.get('/reviews')
      .then(res => setReviews(res.data))
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, []);

  if (loadingReviews || reviews.length === 0) {
    return null; // Don't show section if no reviews yet
  }

  const totalStars = reviews.reduce((sum, r) => sum + r.stars, 0);
  const avgStars = (totalStars / reviews.length).toFixed(1);

  return (
    <div className="reviews-section">
      <button className="reviews-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="reviews-stars">
          {'★'.repeat(Math.round(avgStars))}{'☆'.repeat(5 - Math.round(avgStars))}
        </span>
        <span className="reviews-avg">{avgStars} / 5</span>
        <span className="reviews-count">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
        <span className="reviews-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="reviews-list">
          {reviews.map((r) => (
            <div key={r._id} className="review-card">
              <div className="review-header">
                <strong>{r.name}</strong>
                <span className="review-stars">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
              </div>
              {r.text && <p>{r.text}</p>}
              {r.photos && r.photos.length > 0 && (
                <div className="review-photos">
                  {r.photos.map((photo, i) => (
                    <img
                      key={i}
                      src={`${UPLOADS_BASE}/uploads/reviews/${photo}`}
                      alt={`Review photo ${i + 1}`}
                      className="review-photo"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function generateTimeSlots(date, duration = 2) {
  if (!date) return [];
  const d = DateTime.fromISO(date, { zone: 'America/Los_Angeles' });
  const day = d.weekday % 7; // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const startHour = isWeekend ? 9 : 17;
  const endHour = isWeekend ? 20 : 21;

  const slots = [];
  for (let h = startHour; h <= endHour - duration; h++) {
    const start = d.startOf('day').set({ hour: h });
    const slotDate = start.toJSDate();
    const endDate = start.plus({ hours: duration }).toJSDate();
    slots.push({
      start: slotDate,
      end: endDate,
      label: `${formatTime(h)} - ${formatTime(h + duration)}`,
    });
  }
  return slots;
}

function formatTime(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${ampm}`;
}

const MIN_ADVANCE_HOURS = 36;

function CalendarPicker({ selectedDate, onDateChange, selectedSlot, onSlotChange, bookedSlots, duration, currentMonth, setCurrentMonth, availabilityReady }) {

  const now = new Date();
  const earliestBookable = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);

  // A day is disabled if even its latest possible slot (6 PM start) is within 36 hours
  const isDayDisabled = (date) => {
    if (!availabilityReady) return true;
    const day = DateTime.fromJSDate(date).toISODate();
    return !generateTimeSlots(day, duration).some(slot => !isSlotTooSoon(slot) && !isSlotBooked(slot));
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const isSlotBooked = (slot) => {
    return bookedSlots.some(b => {
      const bookedStart = new Date(b.date).getTime();
      const bookedEnd = bookedStart + (b.duration || 120) * 60 * 1000;
      const slotStart = slot.start.getTime();
      const slotEnd = slot.end.getTime();
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  };

  const isSlotTooSoon = (slot) => {
    return slot.start <= earliestBookable;
  };

  const timeSlots = generateTimeSlots(selectedDate, duration);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="calendar-picker">
      <div className="calendar-header">
        <button type="button" onClick={prevMonth} className="cal-nav">&lsaquo;</button>
        <span className="cal-month">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="cal-nav">&rsaquo;</button>
      </div>
      <div className="cal-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>
      <div className="cal-days">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="cal-day empty" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const disabled = isDayDisabled(date);
          const isSelected = selectedDate && date.toDateString() === DateTime.fromISO(selectedDate).toJSDate().toDateString();

          return (
            <button
              type="button"
              key={day}
              className={`cal-day ${disabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
              disabled={disabled}
              onClick={() => {
                onDateChange(DateTime.fromJSDate(date).toISODate());
                onSlotChange(null);
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="time-slots">
          <h4>Available Time Slots</h4>
          {timeSlots.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No slots available for this day.</p>
          ) : (
            <div className="time-slots-grid">
              {timeSlots.map((slot, i) => {
                const booked = isSlotBooked(slot);
                const tooSoon = isSlotTooSoon(slot);
                const unavailable = !availabilityReady || booked || tooSoon;
                const isSelected = selectedSlot && slot.start.getTime() === new Date(selectedSlot).getTime();
                return (
                  <button
                    type="button"
                    key={i}
                    className={`time-slot ${unavailable ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                    disabled={unavailable}
                    onClick={() => onSlotChange(slot.start.toISOString())}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrivateEvents() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = DateTime.now().setZone('America/Los_Angeles');
    return new Date(now.year, now.month - 1, 1);
  });
  const [availabilityMonth, setAvailabilityMonth] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const availabilityReady = availabilityMonth === monthKey && !availabilityError;
  const [tentCount, setTentCount] = useState(1);
  const [duration, setDuration] = useState(2); // 2 or 4 hours
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [customPlace, setCustomPlace] = useState(null); // { name, address, lat, lng }
  const [locations, setLocations] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestConfirmed, setRequestConfirmed] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // form, payment, success
  const [loading, setLoading] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // Fetch all locations on mount
  useEffect(() => {
    api.get('/private-bookings/locations').then(res => {
      console.log(res.data);
      setLocations(res.data);
    }).catch(() => {});
  }, []);

  // Fetch available locations when date changes
  useEffect(() => {
    if (!selectedDate) return;
    api.get(`/private-bookings/available-locations?date=${selectedDate}`)
      .then(res => {
        setLocations(res.data);
        // If the selected location is not in the new list, clear it
        if (selectedLocation && !res.data.find(l => l.id === selectedLocation)) {
          setSelectedLocation(null);
        }
      })
      .catch(() => {});
  }, [selectedDate]);

  // Fetch before selecting a day; ignore responses from previously viewed months.
  useEffect(() => {
    let active = true;
    setAvailabilityError('');
    setAvailabilityMonth('');
    setSelectedDate(null);
    setSelectedSlot(null);
    const start = DateTime.fromObject({ year: currentMonth.getFullYear(), month: currentMonth.getMonth() + 1, day: 1 }, { zone: 'America/Los_Angeles' });
    api.get('/private-bookings/booked-slots', { params: { start: start.toUTC().toISO(), end: start.plus({ months: 1 }).toUTC().toISO() } })
      .then(({ data }) => { if (active) { setBookedSlots(data); setAvailabilityMonth(monthKey); } })
      .catch(() => { if (active) setAvailabilityError('Availability temporarily unavailable. Refresh this page to try again.'); });
    return () => { active = false; };
  }, [currentMonth, monthKey]);

  useEffect(() => { setSelectedSlot(null); }, [duration]);

  const basePrice = tentCount === 2 ? 700 : 450;
  const price = duration === 4 ? basePrice * 2 : duration === 3 ? Math.round(basePrice * 1.5) : basePrice;
  const capacity = tentCount === 2 ? 24 : 12;

  const hasLocation = selectedLocation || customPlace;
  const isFormValid = availabilityReady && name && phone && email && selectedDate && selectedSlot && hasLocation && waiverAccepted;

  const handleProceedToPayment = async () => {
    if (!isFormValid) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/private-booking-requests', {
        tentCount, duration, date: selectedSlot, name, email, phone, waiverAccepted,
        locationId: selectedLocation || undefined,
        customLocation: !selectedLocation ? customPlace?.address : undefined,
        customLocationName: !selectedLocation ? customPlace?.name : undefined,
      });
      setRequestId(res.data.requestId);
      setClientSecret(res.data.clientSecret);
      setStep('payment');
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (stripePaymentId) => {
    setError('');
    try {
      const { data } = await api.post(`/private-booking-requests/${requestId}/submitted`, { paymentIntentId: stripePaymentId });
      setRequestConfirmed(data.status === 'confirmed');
      setStep('success');
    } catch (err) {
      const msg = err.response?.data?.error || 'Error completing booking';
      alert(msg);
      setError(msg);
    }
  };

  if (step === 'success') {
    return (
      <div className="booking-container">
        <div className="success-message">
          <h2>{requestConfirmed ? 'Booking confirmed' : 'Booking request submitted'}</h2>
          <p>{requestConfirmed ? 'Your booking has been approved. A confirmation email will follow.' : 'Your timeslot and booking is under review we will get back to you shortly'}</p>
          <p>{requestConfirmed ? 'Payment has completed.' : 'Your card has been authorized. Payment will be collected only after approval.'}</p>
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 24, textDecoration: 'none' }}>
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="private-booking-page">
      <Link to="/" style={{ textDecoration: 'none', color: '#BA160C', display: 'inline-block', marginBottom: 16, fontSize: '1.1rem' }}>&larr; Back Home</Link>

      <h1>Book a Private Sauna Event</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Reserve an exclusive sauna experience for you and your group at a beautiful San Francisco waterfront location.
      </p>

      {/* Photo Collage */}
      <PhotoCollage />

      {/* What's Included */}
      <div className="included-section">
        <h3>What's Included</h3>
        <ul className="included-list">
          <li>Sauna Tent set up near the water</li>
          <li>Cooler with Drinks</li>
          <li>Changing Tent</li>
        </ul>
      </div>

      {/* Reviews */}
      <ReviewsSection />

      {step === 'form' && (
        <>
          {/* Tent Selection */}
          <div className="booking-section">
            <h3>Select Package</h3>
            <div className="tent-options">
              {TENT_OPTIONS.map(opt => (
                <label key={opt.count} className={`tent-option ${tentCount === opt.count ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="tentCount"
                    value={opt.count}
                    checked={tentCount === opt.count}
                    onChange={() => setTentCount(opt.count)}
                  />
                  <div className="tent-option-content">
                    <strong>{opt.count} Tent{opt.count > 1 ? 's' : ''}</strong>
                    <span className="tent-capacity">{opt.capacity} people capacity</span>
                    <span className="tent-price">${opt.price}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="booking-section">
            <h3>Select Duration</h3>
            <div className="duration-options">
              <label className={`duration-option ${duration === 2 ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="duration"
                  value={2}
                  checked={duration === 2}
                  onChange={() => setDuration(2)}
                />
                <div className="duration-option-content">
                  <strong>2 Hours</strong>
                  <span className="duration-description">Perfect for most events</span>
                </div>
              </label>
              <label className={`duration-option ${duration === 3 ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="duration"
                  value={3}
                  checked={duration === 3}
                  onChange={() => setDuration(3)}
                />
                <div className="duration-option-content">
                  <strong>3 Hours</strong>
                  <span className="duration-description">A little extra time</span>
                  <span className="duration-price-tag">+${Math.round(basePrice * 0.5)}</span>
                </div>
              </label>
              <label className={`duration-option ${duration === 4 ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="duration"
                  value={4}
                  checked={duration === 4}
                  onChange={() => setDuration(4)}
                />
                <div className="duration-option-content">
                  <strong>4 Hours</strong>
                  <span className="duration-description">Extended time for larger gatherings</span>
                  <span className="duration-price-tag">+${basePrice}</span>
                </div>
              </label>
            </div>
          </div>

          {/* Pricing Total */}
          <div className="pricing-total">
            <span className="pricing-total-label">Total</span>
            <span className="pricing-total-amount">${price}</span>
          </div>

          {/* Calendar */}
          <div className="booking-section">
            <h3>Choose Date & Time</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 12 }}>
              Sat & Sun: 9 AM - 8 PM | Weekdays: 5 PM - 9 PM (2-hour slots)
            </p>
            {availabilityError ? <p role="alert">{availabilityError}</p> : !availabilityReady && <p>Checking availability…</p>}
            <p>All booking times are San Francisco time.</p>
            <CalendarPicker
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              availabilityReady={availabilityReady}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedSlot={selectedSlot}
              onSlotChange={setSelectedSlot}
              bookedSlots={bookedSlots}
              duration={duration}
            />
          </div>

          {/* Location */}
          <div className="booking-section">
            <h3>Location</h3>
            {!selectedDate ? (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Please select a date first.</p>
            ) : locations.length === 1 ? (
              <>
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 12 }}>
                  Another event is already booked on this day. Location is set to:
                </p>
                <LocationPicker
                  locations={locations}
                  selectedLocation={selectedLocation}
                  onSelect={(id) => { setSelectedLocation(id); setCustomPlace(null); }}
                  customPlace={customPlace}
                  onCustomPlace={(place) => { setCustomPlace(place); setSelectedLocation(null); }}
                />
              </>
            ) : (
              <LocationPicker
                locations={locations}
                selectedLocation={selectedLocation}
                onSelect={(id) => { setSelectedLocation(id); setCustomPlace(null); }}
                customPlace={customPlace}
                onCustomPlace={(place) => { setCustomPlace(place); setSelectedLocation(null); }}
              />
            )}
          </div>

          {/* Contact Info + Waiver */}
          <div className="booking-section">
            <h3>Your Information</h3>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label>Cell Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>

            <h3 style={{ marginTop: 24 }}>Liability Waiver</h3>
            <LiabilityWaiver accepted={waiverAccepted} onChange={setWaiverAccepted} />
          </div>

          {/* Summary & Pay */}
          <div className="booking-summary">
            <div className="summary-row">
              <span>Package</span>
              <span>{tentCount} Tent{tentCount > 1 ? 's' : ''} ({capacity} people)</span>
            </div>
            {selectedSlot && (
              <div className="summary-row">
                <span>Date & Time</span>
                <span>{new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(selectedSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(new Date(selectedSlot).getTime() + duration * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            )}
            {hasLocation && (
              <div className="summary-row">
                <span>Location</span>
                <span>{selectedLocation ? locations.find(l => l.id === selectedLocation)?.name : customPlace?.name}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total</span>
              <span>${price}</span>
            </div>
          </div>

          {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}

          {!isFormValid && (
            <p style={{ color: '#1a1a1a', fontSize: '0.85rem', marginBottom: 12 }}>
              Please complete:{' '}
              {[
                !selectedDate && 'date',
                !selectedSlot && 'time slot',
                !hasLocation && 'location',
                !name && 'name',
                !phone && 'phone',
                !email && 'email',
                !waiverAccepted && 'liability waiver',
              ].filter(Boolean).join(', ')}
            </p>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px 24px', fontSize: '1.1rem' }}
            disabled={!isFormValid || loading}
            onClick={handleProceedToPayment}
          >
            {loading ? 'Setting up payment...' : `Request booking - $${price}`}
          </button>
        </>
      )}

      {step === 'payment' && (
        <div className="booking-section">
          <h3>Payment</h3>
          <div className="booking-summary" style={{ marginBottom: 20 }}>
            <div className="summary-row">
              <span>Package</span>
              <span>{tentCount} Tent{tentCount > 1 ? 's' : ''} ({capacity} people)</span>
            </div>
            {selectedSlot && (
              <div className="summary-row">
                <span>Date & Time</span>
                <span>{new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(selectedSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(new Date(selectedSlot).getTime() + duration * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            )}
            {hasLocation && (
              <div className="summary-row">
                <span>Location</span>
                <span style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', textAlign: 'right'}}>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                    {selectedLocation
                      ? locations.find(l => l.id === selectedLocation)?.name
                      : customPlace?.name}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {selectedLocation
                      ? locations.find(l => l.id === selectedLocation)?.address
                      : customPlace?.address}
                  </span>
                </span>
              </div>
            )}
            <div className="summary-row">
              <span>Name</span>
              <span>{name}</span>
            </div>
            <div className="summary-row">
              <span>Phone</span>
              <span>{phone}</span>
            </div>
            <div className="summary-row">
              <span>Email</span>
              <span>{email}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>${price}</span>
            </div>
          </div>
          {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}
          <p>Your card will be authorized now. Payment is collected only after approval. Unanswered requests expire within 24 hours.</p>
          <StripePaymentForm authorizeOnly buttonLabel="Authorize payment and request booking" clientSecret={clientSecret} onSuccess={handlePaymentSuccess} onError={setError} />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => { setStep('form'); setClientSecret(''); }}
          >
            Back to Details
          </button>
        </div>
      )}
    </div>
  );
}

export default PrivateEvents;
