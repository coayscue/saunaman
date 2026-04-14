import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import StripePaymentForm from "../components/StripePaymentForm";
import api from "../api";

function PayInvoice() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get(`/invoices/${invoiceId}`)
      .then(res => setInvoice(res.data))
      .catch(() => setError("Invoice not found"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const handlePay = async () => {
    setError("");
    setPaying(true);
    try {
      const res = await api.post(`/invoices/${invoiceId}/create-intent`);
      setClientSecret(res.data.clientSecret);
    } catch (err) {
      setError(err.response?.data?.error || "Error setting up payment");
      setPaying(false);
    }
  };

  const handlePaymentSuccess = async (stripePaymentId) => {
    try {
      const res = await api.post(`/invoices/${invoiceId}/pay`, { stripePaymentId });
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error recording payment");
    }
  };

  if (loading) return <div className="booking-container"><p>Loading...</p></div>;
  if (error && !invoice) {
    return (
      <div className="booking-container">
        <p style={{ color: "#dc2626" }}>{error}</p>
        <Link to="/" style={{ color: "#BA160C" }}>&larr; Back Home</Link>
      </div>
    );
  }
  if (!invoice) return null;

  const status = invoice.cancelled ? "Cancelled" : invoice.paid ? "Paid" : "Unpaid";
  const statusColor = invoice.cancelled ? "#dc2626" : invoice.paid ? "#059669" : "#b45309";

  return (
    <div className="booking-container">
      <Link to="/" style={{ textDecoration: 'none', color: '#BA160C', display: 'inline-block', marginBottom: 16, fontSize: '1.1rem' }}>&larr; Back Home</Link>

      <h1 style={{ color: statusColor, fontSize: "2.5rem", marginBottom: 8 }}>{status}</h1>

      <div style={{ background: "#1a1a1a", padding: 24, borderRadius: 12, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, color: "#fff" }}>Invoice</h2>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#aaa" }}>Amount</span>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: "1.2rem" }}>${invoice.amount.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#aaa" }}>Date</span>
          <span style={{ color: "#fff" }}>{new Date(invoice.date_created).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        </div>
        {invoice.paid && invoice.date_paid && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#aaa" }}>Date Paid</span>
            <span style={{ color: "#059669" }}>{new Date(invoice.date_paid).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#aaa" }}>To</span>
          <span style={{ color: "#fff" }}>{invoice.user?.name || invoice.user?.email}</span>
        </div>
        {invoice.description && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ color: "#aaa" }}>Description</span>
            <span style={{ color: "#fff", textAlign: "right", maxWidth: "60%" }}>{invoice.description}</span>
          </div>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}

      {!invoice.paid && !invoice.cancelled && !clientSecret && (
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handlePay} disabled={paying}>
          {paying ? "Setting up payment..." : `Pay $${invoice.amount.toFixed(2)}`}
        </button>
      )}

      {!invoice.paid && !invoice.cancelled && clientSecret && (
        <div>
          <h2>Payment — ${invoice.amount.toFixed(2)}</h2>
          <StripePaymentForm
            clientSecret={clientSecret}
            onSuccess={handlePaymentSuccess}
            onError={setError}
            buttonLabel={`Pay $${invoice.amount.toFixed(2)}`}
          />
        </div>
      )}

      {invoice.paid && (
        <p style={{ color: "#059669", textAlign: "center", fontSize: "1.1rem" }}>
          This invoice has been paid. Thank you!
        </p>
      )}

      {invoice.cancelled && (
        <p style={{ color: "#dc2626", textAlign: "center", fontSize: "1.1rem" }}>
          This invoice has been cancelled.
        </p>
      )}
    </div>
  );
}

export default PayInvoice;
