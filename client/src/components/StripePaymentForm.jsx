import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51TE1NVArlo4kMrW9yXI9mWZuSY19PLImtpmv7T88Ck5vXFmGT2R9iknmCEufqGz5maJSamu03sAWVjvph0bqLein00XQHDTi5A'
);

function InnerForm({ onSuccess, onError, buttonLabel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

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
      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="btn btn-primary"
        style={{ marginTop: 20, width: '100%' }}
      >
        {processing ? 'Processing...' : buttonLabel}
      </button>
    </form>
  );
}

function StripePaymentForm({ clientSecret, onSuccess, onError, buttonLabel = 'Pay Now', appearance = { theme: 'stripe' } }) {
  if (!clientSecret) return null;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, wallets: { applePay: import.meta.env.PROD ? 'auto' : 'never' } }}>
      <InnerForm onSuccess={onSuccess} onError={onError} buttonLabel={buttonLabel} />
    </Elements>
  );
}

export default StripePaymentForm;
