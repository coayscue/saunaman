const publicRouter = require("express").Router();
const adminRouter = require("express").Router();
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendInvoiceCreated, sendInvoicePaid } = require("../utils/email");

// PUBLIC: Get invoice by ID (for payment page)
publicRouter.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("user");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Create payment intent for invoice
publicRouter.post("/:id/create-intent", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.paid)
      return res.status(400).json({ error: "Invoice already paid" });
    if (invoice.cancelled)
      return res.status(400).json({ error: "Invoice has been cancelled" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(invoice.amount * 100),
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

// PUBLIC: Mark invoice as paid
publicRouter.post("/:id/pay", async (req, res) => {
  try {
    const { stripePaymentId } = req.body;
    const invoice = await Invoice.findById(req.params.id).populate("user");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.paid)
      return res.status(400).json({ error: "Invoice already paid" });
    if (invoice.cancelled)
      return res.status(400).json({ error: "Invoice has been cancelled" });

    invoice.paid = true;
    invoice.date_paid = new Date();
    invoice.stripe_payment_id = stripePaymentId;
    await invoice.save();

    await sendInvoicePaid(invoice.user, invoice);

    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Get all invoices
adminRouter.get("/", async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("user")
      .sort({ date_created: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Create invoice
adminRouter.post("/", async (req, res) => {
  try {
    const { name, email, amount, description } = req.body;
    if (!name || !email || !amount) {
      return res
        .status(400)
        .json({ error: "Name, email, and amount are required" });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email });
      await user.save();
    } else if (name && user.name !== name) {
      user.name = name;
      await user.save();
    }

    const invoice = new Invoice({
      amount: parseFloat(amount),
      description: description || "",
      user: user._id,
    });
    await invoice.save();

    // Populate user for email
    await invoice.populate("user");

    await sendInvoiceCreated(user, invoice);

    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Cancel invoice
adminRouter.post("/:id/cancel", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("user");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.paid)
      return res.status(400).json({ error: "Cannot cancel a paid invoice" });

    invoice.cancelled = true;
    await invoice.save();

    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
