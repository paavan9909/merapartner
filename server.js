const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------
// Razorpay
// -----------------------------

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

// -----------------------------
// Supabase
// -----------------------------

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      )
    : null;

// -----------------------------
// Frontend configuration
// -----------------------------

app.get("/api/config", (req, res) => {
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || null,
    registrationFee: 300,
  });
});

// -----------------------------
// Create ₹300 registration order
// -----------------------------

app.post("/api/create-registration-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res
        .status(503)
        .json({ error: "Razorpay is not configured yet." });
    }

    const order = await razorpay.orders.create({
      amount: 30000,
      currency: "INR",
      receipt: "reg_" + Date.now(),
      notes: {
        purpose: "MeraPartner registration fee",
      },
    });

    // Save the order in Supabase if available
    if (supabase) {
      await supabase.from("registration_payments").insert({
        razorpay_order_id: order.id,
        amount: 300,
        status: "created",
      });
    }

    res.json(order);
  } catch (error) {
    console.error("Create registration order error:", error);
    res.status(500).json({
      error: "Could not create registration order.",
    });
  }
});

// -----------------------------
// Verify registration payment
// -----------------------------

app.post("/api/verify-registration", async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res
        .status(503)
        .json({ error: "Razorpay is not configured yet." });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      email,
      phone,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: "Missing payment verification details.",
      });
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const valid =
      generatedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, "utf8"),
        Buffer.from(razorpay_signature, "utf8")
      );

    if (!valid) {
      return res.status(400).json({
        error: "Payment verification failed.",
      });
    }

    // -----------------------------
    // Save user + payment in Supabase
    // -----------------------------

    if (supabase && email) {
      // Create/update user
      const { data: user, error: userError } = await supabase
        .from("users")
        .upsert(
          {
            full_name: name || "MeraPartner User",
            email: email,
            phone: phone || null,
            is_18_plus: true,
            registration_paid: true,
          },
          {
            onConflict: "email",
          }
        )
        .select()
        .single();

      if (userError) {
        console.error("Supabase user error:", userError);
        return res.status(500).json({
          error: "Payment verified, but user registration could not be saved.",
        });
      }

      // Save payment
      const { error: paymentError } = await supabase
        .from("registration_payments")
        .update({
          user_id: user.id,
          razorpay_payment_id: razorpay_payment_id,
          status: "paid",
        })
        .eq("razorpay_order_id", razorpay_order_id);

      if (paymentError) {
        console.error("Supabase payment error:", paymentError);
        return res.status(500).json({
          error: "Payment verified, but payment record could not be saved.",
        });
      }
    }

    res.json({
      verified: true,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Verify registration error:", error);

    res.status(500).json({
      error: "Could not verify payment.",
    });
  }
});

// -----------------------------
// Booking payment order
// -----------------------------

app.post("/api/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res
        .status(503)
        .json({ error: "Razorpay is not configured yet." });
    }

    const amountInRupees = Number(req.body.amount || 0);

    if (!amountInRupees || amountInRupees < 1) {
      return res.status(400).json({
        error: "Invalid amount",
      });
    }

    const amount = Math.round(amountInRupees * 100);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "merapartner_" + Date.now(),
    });

    res.json(order);
  } catch (error) {
    console.error("Create booking order error:", error);

    res.status(500).json({
      error: "Could not create booking order.",
    });
  }
});

// -----------------------------
// Serve website
// -----------------------------

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------
// Start server
// -----------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MeraPartner running on port ${PORT}`);
});
