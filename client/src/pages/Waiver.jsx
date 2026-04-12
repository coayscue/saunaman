import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import LiabilityWaiver from "../components/LiabilityWaiver";

function Waiver() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSign = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !waiverAccepted) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/users/sign-waiver", { name: name.trim(), email: email.trim() });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Error signing waiver");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-container">
      <Link to="/" style={{ textDecoration: "none", color: "#BA160C", display: "inline-block", marginBottom: 16, fontSize: "1.1rem" }}>
        &larr; Back Home
      </Link>
      <h1>Sign Waiver</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Please sign our liability waiver before your sauna session.
      </p>

      {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}

      {done ? (
        <div className="success-message">
          <h2>Thank You, {name}!</h2>
          <p style={{ marginTop: 16, color: "#6b7280" }}>
            Your waiver has been signed and recorded. You're all set for your sauna session!
          </p>
          <Link to="/" className="btn btn-primary" style={{ display: "inline-block", marginTop: 24, textDecoration: "none" }}>
            Back to Home
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSign}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>
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

          <div style={{ marginTop: 24 }}>
            <LiabilityWaiver accepted={waiverAccepted} onChange={setWaiverAccepted} />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!waiverAccepted || submitting}
          >
            {submitting ? "Signing..." : "Sign Waiver"}
          </button>
        </form>
      )}
    </div>
  );
}

export default Waiver;
