const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

app.get("/api/config", (req, res) => {
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || null,
    registrationFee: 300,
  });
});

// Creates the fixed ₹300 registration order.
app.post("/api/create-registration-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: "Razorpay is not configured yet." });
    }

    const order = await razorpay.orders.create({
      amount: 30000,
      currency: "INR",
      receipt: "reg_" + Date.now(),
      notes: { purpose: "MeraPartner registration fee" },
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Verifies the Razorpay checkout signature on the server.
app.post("/api/verify-registration", (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Razorpay is not configured yet." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification details." });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "utf8"),
      Buffer.from(razorpay_signature, "utf8")
    );

    if (!valid) {
      return res.status(400).json({ error: "Payment verification failed." });
    }

    res.json({ verified: true, paymentId: razorpay_payment_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not verify payment." });
  }
});

// Existing booking order endpoint; keep for the later booking-payment step.
app.post("/api/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: "Razorpay is not configured yet." });
    }

    const amount = Math.max(100, Math.round(Number(req.body.amount || 0) * 100));
    if (!amount) return res.status(400).json({ error: "Invalid amount" });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "comp_" + Date.now(),
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Companio running on port ${PORT}`));
