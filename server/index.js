const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();

const path = require("path");

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  let responseBody;
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };
  res.on("finish", () => {
    const ms = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`;
    if (res.statusCode >= 400) {
      console.error(line, responseBody ? JSON.stringify(responseBody) : '');
    } else {
      console.log(line);
    }
  });
  next();
});

// Serve uploaded review photos statically
app.use(
  "/uploads/reviews",
  express.static(path.join(__dirname, "uploads", "reviews")),
);

// Admin session tokens (in-memory)
const adminTokens = new Set();

// Admin path verification — issues a token on success
const ADMIN_PATH = process.env.ADMIN_PATH || "/admin-secret-dashboard-254";
app.post("/api/admin/verify", (req, res) => {
  const valid = req.body.path === ADMIN_PATH;
  if (valid) {
    const token = uuidv4();
    adminTokens.add(token);
    return res.json({ valid: true, token });
  }
  res.json({ valid: false });
});

// Admin auth middleware
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || !adminTokens.has(token)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

// Public routes (customer-facing)
app.use("/api/events", require("./routes/events").publicRouter);
app.use("/api/users", require("./routes/users").publicRouter);
app.use("/api/reservations", require("./routes/reservations").publicRouter);
app.use("/api/payments", require("./routes/payments"));
app.use("/api/private-bookings", require("./routes/privateBookings"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/donations", require("./routes/donations").publicRouter);

// Admin routes (require token)
app.use("/api/events", requireAdmin, require("./routes/events").adminRouter);
app.use("/api/users", requireAdmin, require("./routes/users").adminRouter);
app.use(
  "/api/reservations",
  requireAdmin,
  require("./routes/reservations").adminRouter,
);
app.use(
  "/api/donations",
  requireAdmin,
  require("./routes/donations").adminRouter,
);

// Error handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error(`ERROR ${req.method} ${req.originalUrl}:`, err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saunaman";

// Post-event review email scheduler
const Reservation = require("./models/Reservation");
const Event = require("./models/Event");
const { sendReviewRequest } = require("./utils/email");

async function sendPendingReviewEmails() {
  try {
    // Find reservations where:
    // - not cancelled
    // - review email not yet sent
    // - event has ended (date + duration is in the past)
    const reservations = await Reservation.find({
      cancelled: false,
      review_email_sent: false,
    })
      .populate("event")
      .populate("user");

    const now = new Date();
    for (const reservation of reservations) {
      if (!reservation.event || !reservation.user) continue;
      const eventEnd = new Date(
        reservation.event.date.getTime() +
          (reservation.event.duration || 90) * 60 * 1000,
      );
      if (eventEnd < now) {
        await sendReviewRequest(
          reservation.user,
          reservation.event,
          reservation,
        );
        reservation.review_email_sent = true;
        await reservation.save();
      }
    }
  } catch (err) {
    console.error("Review email scheduler error:", err);
  }
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    // Check for pending review emails every 30 minutes
    setInterval(sendPendingReviewEmails, 30 * 60 * 1000);
    // Also run once on startup after a short delay
    setTimeout(sendPendingReviewEmails, 10 * 1000);
  })
  .catch((err) => console.error("MongoDB connection error:", err));
