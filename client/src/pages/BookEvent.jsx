import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import StripePaymentForm from "../components/StripePaymentForm";
import api from "../api";
import LiabilityWaiver from "../components/LiabilityWaiver";

function BookEvent() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState(1); // 1=email, 2=name, 3=waiver, 4=payment, 5=done
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [user, setUser] = useState(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/events/${eventId}`),
      api.get(`/events/${eventId}/guests`),
    ])
      .then(([eventRes, guestsRes]) => {
        setEvent(eventRes.data);
        setGuests(guestsRes.data);
      })
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setStep(2);
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    setStep(3);
  };

  const handleWaiverAccept = () => {
    setWaiverAccepted(true);
    // Find or create user, then proceed to payment
    api
      .post("/users/find-or-create", { email, name })
      .then((res) => {
        setUser(res.data);
        // Check if user has credits
        if (res.data.credits > 0) {
          setStep(4); // go to payment step which will show credit option
        } else {
          // Create payment intent
          return api
            .post("/payments/create-intent", { amount: event.price })
            .then((payRes) => {
              setClientSecret(payRes.data.clientSecret);
              setStep(4);
            });
        }
      })
      .catch((err) =>
        setError(err.response?.data?.error || "Error creating user"),
      );
  };

  const handleUseCredit = async () => {
    try {
      await api.post("/reservations", {
        eventId: event._id,
        userId: user._id,
        usedCredit: true,
      });
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.error || "Error creating reservation");
    }
  };

  const handlePaymentSuccess = async (stripePaymentId) => {
    try {
      await api.post("/reservations", {
        eventId: event._id,
        userId: user._id,
        stripePaymentId,
      });
      setStep(5);
    } catch (err) {
      const msg = err.response?.data?.error || "Error creating reservation";
      alert(msg);
      setError(msg);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error && !event) return <p style={{ color: "#dc2626" }}>{error}</p>;
  if (!event) return <p>Event not found</p>;

  return (
    <div className="booking-container">
      <Link to="/" style={{ textDecoration: 'none', color: '#BA160C', display: 'inline-block', marginBottom: 16, fontSize: '1.1rem' }}>&larr; Back Home</Link>
      <h2>Book: {event.name}</h2>
      <p style={{ color: "#60a5fa", marginBottom: 8 }}>
        {new Date(event.date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {event.endDate && (
          <>
            {" – "}
            {new Date(event.endDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        )}
      </p>
      <p style={{ color: "#10b981", fontSize: "1.2rem", marginBottom: 16 }}>
        ${event.price}
      </p>
      {event.location?.name && (
        <div style={{ marginBottom: 24 }}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location.address || event.location.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#BA160C', fontWeight: 600, textDecoration: 'none', display: 'block', marginBottom: 8 }}
          >
            📍 {event.location.name}
          </a>
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <iframe
              title="Event Location"
              width="100%"
              height="130"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location.address || event.location.name)}&output=embed`}
            />
          </div>
        </div>
      )}

      {guests.length > 0 && (
        <div style={{ marginBottom: 24, background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
          <h3 style={{ color: "#e0e0e0", marginBottom: 12, fontSize: "1rem" }}>
            Registered Guests ({guests.length}{event.max_capacity ? `/${event.max_capacity}` : ""})
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {guests.map((name, i) => (
              <li key={i} style={{ background: "#252540", borderRadius: 20, padding: "4px 12px", color: "#c0c0d0", fontSize: "0.9rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="step-indicator">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`step ${step === s ? "active" : ""} ${step > s ? "done" : ""}`}
          >
            {step > s ? "✓" : s}
          </div>
        ))}
      </div>

      {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}

      {step === 1 && (
        <form onSubmit={handleEmailSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleNameSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            Continue
          </button>
        </form>
      )}

      {step === 3 && (
        <div>
          <h2>Liability Waiver</h2>
          <LiabilityWaiver accepted={waiverAccepted} onChange={setWaiverAccepted} />
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 24 }}
            disabled={!waiverAccepted}
            onClick={handleWaiverAccept}
          >
            Accept & Continue
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>Payment</h2>
          {user && user.credits > 0 && (
            <div
              style={{
                background: "#1a1a2e",
                border: "1px solid #10b981",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <p style={{ color: "#10b981", fontWeight: 600 }}>
                You have {user.credits} credit(s) available!
              </p>
              <button
                className="btn btn-success"
                style={{ marginTop: 8 }}
                onClick={handleUseCredit}
              >
                Use 1 Credit (Free)
              </button>
            </div>
          )}
          <StripePaymentForm clientSecret={clientSecret} onSuccess={handlePaymentSuccess} onError={setError} />
          {!clientSecret && user && user.credits <= 0 && (
            <p>Setting up payment...</p>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="success-message">
          <h2>🔥 Booking Confirmed!</h2>
          <p style={{ marginTop: 16, color: "#aaa" }}>
            A confirmation email has been sent to{" "}
            <strong style={{ color: "#e0e0e0" }}>{email}</strong>.
          </p>
          <p style={{ marginTop: 8, color: "#aaa" }}>
            You can cancel your reservation from the link in the email.
          </p>
        </div>
      )}
    </div>
  );
}

export default BookEvent;
