const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PAYMENT_METHOD_TYPES =
  process.env.NODE_ENV === "production" ? ["apple_pay", "card"] : ["card"];

async function createPaymentIntent(amountInDollars) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountInDollars * 100),
    currency: "usd",
    payment_method_types: PAYMENT_METHOD_TYPES,
  });
  return paymentIntent;
}

module.exports = { stripe, createPaymentIntent };
