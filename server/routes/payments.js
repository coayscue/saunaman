const router = require("express").Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create payment intent
router.post("/create-intent", async (req, res) => {
  try {
    const { amount } = req.body; // amount in dollars
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency: "usd",
      payment_method_types: ["apple_pay", "card"],
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
