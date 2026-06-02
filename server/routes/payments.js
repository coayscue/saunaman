const router = require("express").Router();
const { createPaymentIntent } = require("../utils/stripe");

// Create payment intent
router.post("/create-intent", async (req, res) => {
  try {
    const { amount } = req.body; // amount in dollars
    const paymentIntent = await createPaymentIntent(amount);
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
