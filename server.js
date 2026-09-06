const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------
// Razorpay
// ------------------------------------

const razorpay =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

// ------------------------------------
// Supabase
// ------------------------------------

const supabase =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SECRET_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      )
    : null;

// ------------------------------------
// Configuration
// ------------------------------------

app.get("/api/config", (req, res) => {
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || null,
    registrationFee: 300,
  });
});

// ------------------------------------
// Registration order
// ------------------------------------

app.post("/api/create-registration-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured yet.",
      });
    }

    const order = await razorpay.orders.create({
      amount: 30000,
      currency: "INR",
      receipt: "reg_" + Date.now(),
      notes: {
        purpose: "MeraPartner registration fee",
      },
    });

    if (supabase) {
      const { error } = await supabase
        .from("registration_payments")
        .insert({
          razorpay_order_id: order.id,
          amount: 300,
          status: "created",
        });

      if (error) {
        console.error(
          "Supabase registration order error:",
          error
        );
      }
    }

    res.json(order);
  } catch (error) {
    console.error(
      "Create registration order error:",
      error
    );

    res.status(500).json({
      error: "Could not create registration order.",
    });
  }
});

// ------------------------------------
// Registration payment verification
// ------------------------------------

app.post("/api/verify-registration", async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        error: "Razorpay is not configured yet.",
      });
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

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    const valid =
      generatedSignature.length ===
        razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, "utf8"),
        Buffer.from(razorpay_signature, "utf8")
      );

    if (!valid) {
      return res.status(400).json({
        error: "Payment verification failed.",
      });
    }

    if (supabase && email) {
      const { data: user, error: userError } =
        await supabase
          .from("users")
          .upsert(
            {
              full_name:
                name || "MeraPartner User",
              email,
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
        console.error(
          "Supabase user error:",
          userError
        );

        return res.status(500).json({
          error:
            "Payment verified, but user registration could not be saved.",
        });
      }

      const { error: paymentError } =
        await supabase
          .from("registration_payments")
          .update({
            user_id: user.id,
            razorpay_payment_id,
            status: "paid",
          })
          .eq(
            "razorpay_order_id",
            razorpay_order_id
          );

      if (paymentError) {
        console.error(
          "Supabase payment error:",
          paymentError
        );

        return res.status(500).json({
          error:
            "Payment verified, but payment record could not be saved.",
        });
      }
    }

    res.json({
      verified: true,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error(
      "Verify registration error:",
      error
    );

    res.status(500).json({
      error: "Could not verify payment.",
    });
  }
});

// ------------------------------------
// Create booking Razorpay order
// ------------------------------------

app.post("/api/create-booking-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured yet.",
      });
    }

    const {
      name,
      email,
      phone,
      companionName,
      activity,
      date,
      time,
      duration,
      place,
      amount,
    } = req.body;

    const numericAmount = Number(amount);
    const numericDuration = Number(duration);

    if (!email) {
      return res.status(400).json({
        error: "Customer information is missing.",
      });
    }

    if (!companionName) {
      return res.status(400).json({
        error: "Partner information is missing.",
      });
    }

    if (!date || !time) {
      return res.status(400).json({
        error: "Booking date and time are required.",
      });
    }

    if (!numericDuration || numericDuration < 1) {
      return res.status(400).json({
        error: "Invalid booking duration.",
      });
    }

    if (!numericAmount || numericAmount < 1) {
      return res.status(400).json({
        error: "Invalid booking amount.",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: "INR",
      receipt: "mp_" + Date.now(),
      notes: {
        customer_email: email,
        customer_phone: phone || "",
        companion_name: companionName,
        activity: activity || "",
        booking_date: date,
        booking_time: time,
        duration: String(numericDuration),
        meeting_place: place || "",
      },
    });

    res.json(order);
  } catch (error) {
    console.error(
      "Create booking order error:",
      error
    );

    res.status(500).json({
      error: "Could not create booking order.",
    });
  }
});

// ------------------------------------
// Verify booking payment + save booking
// ------------------------------------

app.post("/api/verify-booking", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured yet.",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: "Missing booking payment details.",
      });
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    const valid =
      generatedSignature.length ===
        razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, "utf8"),
        Buffer.from(razorpay_signature, "utf8")
      );

    if (!valid) {
      return res.status(400).json({
        error: "Booking payment verification failed.",
      });
    }

    // Get the Razorpay order from Razorpay itself.
    // This lets the server use the original order amount/details.
    const order = await razorpay.orders.fetch(
      razorpay_order_id
    );

    if (!order || order.status !== "paid") {
      return res.status(400).json({
        error: "Razorpay order has not been paid.",
      });
    }

    const notes = order.notes || {};

    if (supabase) {
      // Find registered customer
      const { data: user, error: userError } =
        await supabase
          .from("users")
          .select("id")
          .eq(
            "email",
            notes.customer_email || ""
          )
          .maybeSingle();

      if (userError) {
        console.error(
          "Find booking user error:",
          userError
        );

        return res.status(500).json({
          error: "Could not find customer account.",
        });
      }

      if (!user) {
        return res.status(400).json({
          error:
            "Customer registration could not be found.",
        });
      }

      // Try to find the partner in the companions table.
      const { data: companion } =
        await supabase
          .from("companions")
          .select("id")
          .eq(
            "name",
            notes.companion_name || ""
          )
          .maybeSingle();

      // Save the booking
      const { data: booking, error: bookingError } =
        await supabase
          .from("bookings")
          .insert({
            user_id: user.id,
            companion_id:
              companion?.id || null,
            companion_name:
              notes.companion_name || null,
            customer_email:
              notes.customer_email || null,
            customer_phone:
              notes.customer_phone || null,
            activity:
              notes.activity || null,
            booking_date:
              notes.booking_date || null,
            booking_time:
              notes.booking_time || null,
            duration_hours:
              Number(notes.duration) || 1,
            meeting_place:
              notes.meeting_place || null,
            amount: Math.round(order.amount / 100),
            status: "confirmed",
            razorpay_order_id:
              razorpay_order_id,
            razorpay_payment_id:
              razorpay_payment_id,
          })
          .select()
          .single();

      if (bookingError) {
        console.error(
          "Save booking error:",
          bookingError
        );

        return res.status(500).json({
          error:
            "Payment succeeded, but the booking could not be saved.",
        });
      }

      return res.json({
        verified: true,
        bookingId: booking.id,
        paymentId: razorpay_payment_id,
      });
    }

    res.json({
      verified: true,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error(
      "Verify booking error:",
      error
    );

    res.status(500).json({
      error: "Could not verify booking payment.",
    });
  }
});

// ------------------------------------
// Existing generic order endpoint
// ------------------------------------

app.post("/api/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured yet.",
      });
    }

    const amountInRupees =
      Number(req.body.amount || 0);

    if (
      !amountInRupees ||
      amountInRupees < 1
    ) {
      return res.status(400).json({
        error: "Invalid amount",
      });
    }

    const order =
      await razorpay.orders.create({
        amount: Math.round(
          amountInRupees * 100
        ),
        currency: "INR",
        receipt:
          "merapartner_" +
          Date.now(),
      });

    res.json(order);
  } catch (error) {
    console.error(
      "Create generic order error:",
      error
    );

    res.status(500).json({
      error: "Could not create order.",
    });
  }
});

// ------------------------------------
// Website
// ------------------------------------

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ------------------------------------
// Start
// ------------------------------------

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `MeraPartner running on port ${PORT}`
  );
});
