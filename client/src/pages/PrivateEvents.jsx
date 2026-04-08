import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
// Note: AdvancedMarker requires mapId="DEMO_MAP_ID" on the Map component
import api from '../api';
import PhotoCollage from '../components/PhotoCollage';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51TE1NVArlo4kMrW9yXI9mWZuSY19PLImtpmv7T88Ck5vXFmGT2R9iknmCEufqGz5maJSamu03sAWVjvph0bqLein00XQHDTi5A'
);

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
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const startHour = isWeekend ? 9 : 17;
  const endHour = isWeekend ? 20 : 21;

  const slots = [];
  for (let h = startHour; h <= endHour - duration; h++) {
    const slotDate = new Date(d);
    slotDate.setHours(h, 0, 0, 0);
    const endDate = new Date(slotDate);
    endDate.setHours(h + duration);
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

function CalendarPicker({ selectedDate, onDateChange, selectedSlot, onSlotChange, bookedSlots, duration }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const now = new Date();
  const earliestBookable = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);

  // A day is disabled if even its latest possible slot (6 PM start) is within 36 hours
  const isDayDisabled = (date) => {
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const lastSlotHour = isWeekend ? 18 : 19; // last 2hr slot starts at 6PM/7PM
    const latestSlotOnDay = new Date(date);
    latestSlotOnDay.setHours(lastSlotHour, 0, 0, 0);
    return latestSlotOnDay <= earliestBookable;
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
          const isSelected = selectedDate && date.toDateString() === new Date(selectedDate).toDateString();

          return (
            <button
              type="button"
              key={day}
              className={`cal-day ${disabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
              disabled={disabled}
              onClick={() => {
                onDateChange(date.toISOString());
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
                const unavailable = booked || tooSoon;
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

function PlacesAutocomplete({ onPlaceSelect }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;
    if (autocompleteRef.current) return; // already initialized

    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'us' },
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        onPlaceSelect({
          name: place.name || place.formatted_address,
          address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });
  }, [places, onPlaceSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search location or select on map"
      className="places-autocomplete-input"
    />
  );
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    if (zoom) map.setZoom(zoom);
  }, [map, center, zoom]);
  return null;
}

function LocationPicker({ locations, selectedLocation, onSelect, customPlace, onCustomPlace }) {
  const SF_CENTER = { lat: 37.7849, lng: -122.4694 };
  const selected = locations.find(l => l.id === selectedLocation);
  const panTarget = customPlace?.lat
    ? { center: { lat: customPlace.lat, lng: customPlace.lng }, zoom: 15 }
    : selected
      ? { center: { lat: selected.lat, lng: selected.lng }, zoom: 14 }
      : null;

  const handleMapClick = (event) => {
    const lat = event.detail.latLng.lat();
    const lng = event.detail.latLng.lng();

    // Create a custom place with coordinates
    onCustomPlace({
      name: `Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
    });
  };

  return (
    <div className="location-picker-with-map">
      {GOOGLE_MAPS_API_KEY ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <PlacesAutocomplete onPlaceSelect={onCustomPlace} />
          </div>
          <div className="location-map-container">
            <Map
              defaultCenter={SF_CENTER}
              defaultZoom={12}
              mapId="DEMO_MAP_ID"
              style={{ height: '300px', width: '100%' }}
              gestureHandling="cooperative"
              disableDefaultUI={false}
              zoomControl={true}
              streetViewControl={false}
              mapTypeControl={false}
              fullscreenControl={false}
              onClick={handleMapClick}
            >
              {panTarget && <MapController center={panTarget.center} zoom={panTarget.zoom} />}
              {locations.map(loc => (
                <AdvancedMarker
                  key={loc.id}
                  position={{ lat: loc.lat, lng: loc.lng }}
                  onClick={() => onSelect(loc.id)}
                >
                  <Pin background={selectedLocation === loc.id ? '#BA160C' : '#4285F4'} borderColor={selectedLocation === loc.id ? '#8B0000' : '#1a73e8'} glyphColor="#fff" />
                </AdvancedMarker>
              ))}
              {customPlace?.lat && (
                <>
                  <AdvancedMarker position={{ lat: customPlace.lat, lng: customPlace.lng }}>
                    <Pin background="#BA160C" borderColor="#8B0000" glyphColor="#fff" />
                  </AdvancedMarker>
                  <InfoWindow
                    position={{ lat: customPlace.lat, lng: customPlace.lng }}
                    options={{ pixelOffset: { x: 0, y: -28 } }}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <strong>{customPlace.name}</strong>
                      <br />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{customPlace.address}</span>
                    </div>
                  </InfoWindow>
                </>
              )}

              {selected && !customPlace?.lat && (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  options={{ pixelOffset: { x: 0, y: -28 } }}
                >
                  <div style={{ padding: '4px 0' }}>
                    <strong>{selected.name}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>{selected.address}</span>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </div>
        </APIProvider>
      ) : (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Type a location address"
            onChange={e => {
              if (e.target.value.trim()) onCustomPlace({ name: e.target.value, address: e.target.value, lat: null, lng: null });
            }}
          />
        </div>
      )}
    </div>
  );
}

function PaymentForm({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Check if PaymentElement is ready
    const paymentElement = elements.getElement('payment');
    if (!paymentElement) {
      onError('Payment form is still loading. Please wait a moment and try again.');
      return;
    }

    setProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      onError(error.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || !elements || processing} className="btn btn-primary" style={{ marginTop: 20, width: '100%' }}>
        {processing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

function PrivateEvents() {
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

  // Fetch booked slots when month/date changes
  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    api.get(`/private-bookings/booked-slots?start=${start}&end=${end}`)
      .then(res => setBookedSlots(res.data))
      .catch(() => {});
  }, [selectedDate]);

  const basePrice = tentCount === 2 ? 700 : 450;
  const price = duration === 4 ? basePrice * 2 : duration === 3 ? Math.round(basePrice * 1.5) : basePrice;
  const capacity = tentCount === 2 ? 24 : 12;

  const hasLocation = selectedLocation || customPlace;
  const isFormValid = name && phone && email && selectedDate && selectedSlot && hasLocation && waiverAccepted;

  const handleProceedToPayment = async () => {
    if (!isFormValid) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/private-bookings/create-intent', { tentCount, duration });
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
      await api.post('/private-bookings/book', {
        name,
        email,
        phone,
        tentCount,
        duration,
        locationId: selectedLocation || undefined,
        customLocation: !selectedLocation && customPlace ? customPlace.address : undefined,
        customLocationName: !selectedLocation && customPlace ? customPlace.name : undefined,
        date: selectedSlot,
        stripePaymentId,
      });
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Error completing booking');
    }
  };

  if (step === 'success') {
    return (
      <div className="booking-container">
        <div className="success-message">
          <h2>Booking Confirmed!</h2>
          <p style={{ marginTop: 16, color: '#6b7280' }}>
            A confirmation receipt has been sent to <strong style={{ color: '#1a1a1a' }}>{email}</strong>.
          </p>
          <p style={{ marginTop: 8, color: '#6b7280' }}>
            You can cancel your reservation from the link in the email.
          </p>
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
            <CalendarPicker
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
            <div className="waiver-text">
              <h3>SAUNA MAN LIABILITY WAIVER AND RELEASE</h3>
              <p>By signing this waiver, I acknowledge that I am voluntarily participating in sauna sessions provided by Sauna Man.</p>
              <p>I understand that sauna use involves exposure to high temperatures and may pose health risks including but not limited to: dehydration, heat exhaustion, dizziness, fainting, and cardiovascular stress.</p>
              <p>I confirm that I am in good physical health and have no medical conditions that would prevent me from safely using a sauna. I have consulted with my physician if I have any concerns about my ability to participate.</p>
              <p>I agree to follow all posted rules and guidelines, including time limits and hydration recommendations.</p>
              <p>I hereby release Sauna Man, its owners, operators, employees, and agents from any and all liability, claims, demands, or causes of action arising from my participation in sauna sessions.</p>
              <p>I understand that this waiver is binding and applies to all current and future visits.</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={e => setWaiverAccepted(e.target.checked)}
              />
              I have read and agree to the liability waiver
            </label>
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
            {loading ? 'Setting up payment...' : `Proceed to Payment - $${price}`}
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
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ 
              clientSecret, 
              appearance: { theme: 'stripe' }
            }}>
              <PaymentForm onSuccess={handlePaymentSuccess} onError={setError} />
            </Elements>
          )}
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
