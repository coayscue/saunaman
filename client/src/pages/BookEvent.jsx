import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import api from "../api";

const stripePromise = loadStripe(
  "pk_live_51TE1NPA5xEQP8Mr97kJ65MR3Ox0zoGZ9KHecTO6pKhLOhSpgIctCWmklG0CIrhbqEOvSfE0SD0t1GlcIVpDnAMfX006NhjaNCf",
);

function PaymentForm({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      onError(error.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn btn-primary"
        style={{ marginTop: 20, width: "100%" }}
      >
        {processing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}

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

  useEffect(() => {
    api
      .get(`/events/${eventId}`)
      .then((res) => setEvent(res.data))
      .catch((err) => setError("Event not found"))
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
      setError(err.response?.data?.error || "Error creating reservation");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error && !event) return <p style={{ color: "#dc2626" }}>{error}</p>;
  if (!event) return <p>Event not found</p>;

  return (
    <div className="booking-container">
      <h1>Book: {event.name}</h1>
      <p style={{ color: "#60a5fa", marginBottom: 8 }}>
        {new Date(event.date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p style={{ color: "#10b981", fontSize: "1.2rem", marginBottom: 24 }}>
        ${event.price}
      </p>

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
          <div className="waiver-text">
            <h3>SAUNA MAN LIABILITY WAIVER AND RELEASE</h3>
            <p>
              By signing this waiver, I acknowledge that I am voluntarily
              participating in sauna sessions provided by Sauna Man.
            </p>
            <p>
              I understand that sauna use involves exposure to high temperatures
              and may pose health risks including but not limited to:
              dehydration, heat exhaustion, dizziness, fainting, and
              cardiovascular stress.
            </p>
            <p>
              I confirm that I am in good physical health and have no medical
              conditions that would prevent me from safely using a sauna. I have
              consulted with my physician if I have any concerns about my
              ability to participate.
            </p>
            <p>
              I agree to follow all posted rules and guidelines, including time
              limits and hydration recommendations.
            </p>
            <p>
              I hereby release Sauna Man, its owners, operators, employees, and
              agents from any and all liability, claims, demands, or causes of
              action arising from my participation in sauna sessions.
            </p>
            <p>
              I understand that this waiver is binding and applies to all
              current and future visits.
            </p>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={waiverAccepted}
              onChange={(e) => setWaiverAccepted(e.target.checked)}
            />
            I have read and agree to the liability waiver
          </label>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
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
          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "night" } }}
            >
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                onError={setError}
              />
            </Elements>
          )}
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
