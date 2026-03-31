import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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

          <div className="waiver-text" style={{ marginTop: 24 }}>
            <h3>SAUNA MAN LIABILITY WAIVER AND RELEASE</h3>
            <p>By signing this waiver, I acknowledge that I am voluntarily participating in sauna sessions provided by Sauna Man.</p>
            <p>I understand that sauna use involves exposure to high temperatures and may pose health risks including but not limited to: dehydration, heat exhaustion, dizziness, fainting, and cardiovascular stress.</p>
            <p>I confirm that I am in good physical health and have no medical conditions that would prevent me from safely using a sauna. I have consulted with my physician if I have any concerns about my ability to participate.</p>
            <p>I agree to follow all posted rules and guidelines, including time limits and hydration recommendations.</p>
            <p>I hereby release Sauna Man, its owners, operators, employees, and agents from any and all liability, claims, demands, or causes of action arising from my participation in sauna sessions.</p>
            <p>I understand that this waiver is binding and applies to all current and future visits.</p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={waiverAccepted}
              onChange={(e) => setWaiverAccepted(e.target.checked)}
            />
            I have read and agree to the liability waiver
          </label>

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
