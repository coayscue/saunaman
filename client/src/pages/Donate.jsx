import React, { useState } from "react";
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

function PaymentForm({ amount, email, name, onSuccess, onError }) {
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
        {processing ? "Processing..." : `Donate $${amount}`}
      </button>
    </form>
  );
}

function Donate() {
  const [step, setStep] = useState(1); // 1=amount, 2=info, 3=payment, 4=done
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  const presetAmounts = [5, 10, 25, 50];

  const handleAmountSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val < 1) {
      setError("Minimum donation is $1");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    try {
      const res = await api.post("/donations/create-intent", { amount: parseFloat(amount) });
      setClientSecret(res.data.clientSecret);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Error setting up payment");
    }
  };

  const handlePaymentSuccess = async (stripePaymentId) => {
    try {
      await api.post("/donations", {
        amount: parseFloat(amount),
        email,
        name,
        stripePaymentId,
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || "Error recording donation");
    }
  };

  return (
    <div className="booking-container">
      <h1>Support Sauna Man</h1>
      <p style={{ color: "#aaa", marginBottom: 24 }}>
        Your donation helps us keep the sauna fires burning!
      </p>

      {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}

      {step === 1 && (
        <form onSubmit={handleAmountSubmit}>
          <div className="form-group">
            <label>Donation Amount</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`btn ${amount === String(preset) ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAmount(String(preset))}
                  style={{ flex: 1 }}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Or enter a custom amount"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleInfoSubmit}>
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
          <div className="form-group">
            <label>Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            Continue to Payment
          </button>
        </form>
      )}

      {step === 3 && clientSecret && (
        <div>
          <h2>Payment — ${amount} Donation</h2>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: "night" } }}
          >
            <PaymentForm
              amount={amount}
              email={email}
              name={name}
              onSuccess={handlePaymentSuccess}
              onError={setError}
            />
          </Elements>
        </div>
      )}

      {step === 4 && (
        <div className="success-message">
          <h2>Thank You!</h2>
          <p style={{ marginTop: 16, color: "#aaa" }}>
            Your ${amount} donation has been received. We appreciate your support!
          </p>
        </div>
      )}
    </div>
  );
}

export default Donate;
