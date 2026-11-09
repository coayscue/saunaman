import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
const defaultAppearance = { theme: 'stripe' };

function InnerForm({ onSuccess, onError, buttonLabel, authorizeOnly }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !ready || processing) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        onError(error.message || 'Unable to confirm payment.');
      } else if (paymentIntent?.status === (authorizeOnly ? 'requires_capture' : 'succeeded')) {
        await onSuccess(paymentIntent.id);
      } else {
        onError('Payment has not completed. Check its status before trying again.');
      }
    } catch (error) {
      onError(error.message || 'Unable to confirm payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {!ready && !loadError && <p role="status">Loading secure payment form…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      <PaymentElement
        onReady={() => { setReady(true); setLoadError(''); }}
        onLoadError={({ error }) => {
          setReady(false);
          setLoadError(error?.message || 'Unable to load payment form. Check the Stripe keys and refresh.');
        }}
      />
      <button
        type="submit"
        disabled={!stripe || !elements || !ready || processing}
        className="btn btn-primary"
        style={{ marginTop: 20, width: '100%' }}
      >
        {processing ? 'Processing...' : buttonLabel}
      </button>
    </form>
  );
}

function StripePaymentForm({ authorizeOnly = false, clientSecret, onSuccess, onError, buttonLabel = 'Pay Now', appearance = defaultAppearance }) {
  if (!clientSecret) return null;
  if (!publishableKey) return <p role="alert">Payment is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in client/.env.local and restart the development server.</p>;
  return (
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance, wallets: { applePay: import.meta.env.PROD ? 'auto' : 'never' } }}>
      <InnerForm authorizeOnly={authorizeOnly} onSuccess={onSuccess} onError={onError} buttonLabel={buttonLabel} />
    </Elements>
  );
}

export default StripePaymentForm;
