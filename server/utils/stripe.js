const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent(amountInDollars) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountInDollars * 100),
    currency: "usd",
    payment_method_types: ["card"],
  });
  return paymentIntent;
}

module.exports = { stripe, createPaymentIntent };
