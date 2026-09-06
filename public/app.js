const people = [
  {
    name: "Aarav",
    city: "Vadodara",
    price: 1200,
    type: "men",
    tags: ["Coffee", "Events", "Travel"],
    cls: ""
  },
  {
    name: "Riya",
    city: "Ahmedabad",
    price: 1500,
    type: "women",
    tags: ["Dinner", "Movies", "Art"],
    cls: "p2"
  },
  {
    name: "Kabir",
    city: "Mumbai",
    price: 1800,
    type: "men",
    tags: ["Fitness", "Food", "Events"],
    cls: "p3"
  },
  {
    name: "Meera",
    city: "Pune",
    price: 1400,
    type: "women",
    tags: ["Music", "Coffee", "Travel"],
    cls: "p4"
  }
];

const REGISTRATION_KEY = "companio_registration_verified";
const USER_KEY = "merapartner_user";

const cards = document.querySelector("#cards");

function isRegistered() {
  return localStorage.getItem(REGISTRATION_KEY) === "true";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function render(f = "all") {
  if (!isRegistered()) {
    cards.innerHTML = `
      <div class="locked">
        <h3>Partners are available after registration</h3>
        <p>
          Pay the one-time <b>₹300 registration fee</b>
          to unlock partner profiles and booking requests.
        </p>
        <button class="book" onclick="showRegistration()">
          Register for ₹300
        </button>
      </div>`;
    return;
  }

  cards.innerHTML = people
    .filter((p) => f === "all" || p.type === f)
    .map(
      (p) => `
      <article class="card">
        <div class="photo ${p.cls}">
          <span>✓ Verified adult</span>
        </div>

        <div class="body">
          <div class="line">
            <h3>${p.name}</h3>
            <span class="price">₹${p.price}/hr</span>
          </div>

          <div class="meta">
            ${p.city} · Available this week
          </div>

          <div>
            ${p.tags
              .map((t) => `<span class="tag">${t}</span>`)
              .join("")}
          </div>

          <button
            class="book"
            onclick="booking('${p.name}', ${p.price})">
            Request & pay
          </button>
        </div>
      </article>`
    )
    .join("");
}

document.querySelectorAll("#filters button").forEach((b) => {
  b.onclick = () => {
    document
      .querySelectorAll("#filters button")
      .forEach((x) => x.classList.remove("selected"));

    b.classList.add("selected");

    if (!isRegistered()) {
      return showRegistration();
    }

    render(b.dataset.f);
  };
});

function show(kind) {
  const m = document.querySelector("#modal");

  let html = "";

  if (kind === "join") {
    html = `
      <h2>Become a companion</h2>
      <p>
        Adults 18+ only. Applications are reviewed before
        profiles are published.
      </p>

      <input placeholder="Full name">
      <input placeholder="Email">
      <input placeholder="City">

      <button
        class="pay"
        onclick="alert('Demo application submitted.')">
        Submit application
      </button>`;
  }

  if (kind === "howModal") {
    html = `
      <h2>How it works</h2>
      <p>
        Register for ₹300, unlock verified adult companion profiles,
        choose a social activity and request a booking.
        Keep first meetings in public places.
      </p>`;
  }

  document.querySelector("#modalBody").innerHTML = html;
  m.classList.add("show");
}

function showRegistration() {
  const m = document.querySelector("#modal");

  document.querySelector("#modalBody").innerHTML = `
    <h2>Register to discover partners</h2>

    <p class="modal-note">
      18+ only. A one-time <b>₹300 registration fee</b>
      is required before partner profiles and booking requests
      are unlocked.
    </p>

    <input
      id="regName"
      placeholder="Full name"
      autocomplete="name"
    />

    <input
      id="regEmail"
      placeholder="Email address"
      type="email"
      autocomplete="email"
    />

    <input
      id="regPhone"
      placeholder="Mobile number"
      type="tel"
      autocomplete="tel"
    />

    <label class="age-check">
      <input id="regAge" type="checkbox">
      I confirm that I am 18 or older.
    </label>

    <button class="pay" onclick="payRegistration()">
      Pay ₹300 & unlock partners
    </button>

    <small>
      Payment is processed securely by Razorpay.
      Do not enter payment details into this website.
    </small>
  `;

  m.classList.add("show");
}

function hide() {
  document.querySelector("#modal").classList.remove("show");
}

async function payRegistration() {
  const name = document.querySelector("#regName")?.value.trim();
  const email = document.querySelector("#regEmail")?.value.trim();
  const phone = document.querySelector("#regPhone")?.value.trim();
  const age = document.querySelector("#regAge")?.checked;

  if (!name || !email || !phone) {
    return alert(
      "Please enter your name, email and mobile number."
    );
  }

  if (!age) {
    return alert(
      "You must confirm that you are 18 or older."
    );
  }

  try {
    const cfg = await fetch("/api/config").then((r) => r.json());

    if (!cfg.keyId) {
      throw new Error(
        "Razorpay is not configured yet."
      );
    }

    const r = await fetch(
      "/api/create-registration-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          phone
        })
      }
    );

    const order = await r.json();

    if (!r.ok) {
      throw new Error(
        order.error ||
        "Could not create registration order."
      );
    }

    const rz = new Razorpay({
      key: cfg.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "MeraPartner",
      description: "One-time registration fee",
      order_id: order.id,

      prefill: {
        name,
        email,
        contact: phone
      },

      handler: async function (response) {
        try {
          const vr = await fetch(
            "/api/verify-registration",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                ...response,
                name,
                email,
                phone
              })
            }
          );

          const result = await vr.json();

          if (!vr.ok || !result.verified) {
            throw new Error(
              result.error ||
              "Payment verification failed."
            );
          }

          // Save registration locally
          localStorage.setItem(
            REGISTRATION_KEY,
            "true"
          );

          // Save user information locally
          localStorage.setItem(
            USER_KEY,
            JSON.stringify({
              name,
              email,
              phone
            })
          );

          hide();
          render();

          alert(
            "Registration successful. Partner profiles are now unlocked."
          );
        } catch (e) {
          alert(e.message);
        }
      },

      modal: {
        ondismiss: function () {}
      },

      theme: {
        color: "#b65243"
      }
    });

    rz.open();
  } catch (e) {
    alert(e.message);
  }
}

// ---------------------------------------
// BOOKING FORM
// ---------------------------------------

async function booking(name, amount) {
  if (!isRegistered()) {
    return showRegistration();
  }

  show();

  const today = new Date()
    .toISOString()
    .split("T")[0];

  document.querySelector("#modalBody").innerHTML = `
    <h2>Book ${name}</h2>

    <p>
      Rate:
      <b>₹${amount}/hour</b>
    </p>

    <label>Activity</label>

    <select id="activity">
      <option>Coffee & conversation</option>
      <option>Dinner</option>
      <option>Movie / event</option>
      <option>City activity</option>
    </select>

    <label>Date</label>

    <input
      id="date"
      type="date"
      min="${today}"
    >

    <label>Time</label>

    <input
      id="time"
      type="time"
    >

    <label>Duration</label>

    <select id="duration">
      <option value="1">1 hour — ₹${amount}</option>
      <option value="2">2 hours — ₹${amount * 2}</option>
      <option value="3">3 hours — ₹${amount * 3}</option>
      <option value="4">4 hours — ₹${amount * 4}</option>
    </select>

    <label>Public meeting place</label>

    <input
      id="place"
      placeholder="Example: Starbucks, Sayaji Garden"
    >

    <p class="modal-note">
      First meetings should take place in a public location.
    </p>

    <button
      class="pay"
      onclick="payBooking('${name}', ${amount})">
      Continue to secure payment
    </button>
  `;
}

// ---------------------------------------
// BOOKING PAYMENT
// ---------------------------------------

async function payBooking(name, amount) {
  const activity =
    document.querySelector("#activity")?.value;

  const date =
    document.querySelector("#date")?.value;

  const time =
    document.querySelector("#time")?.value;

  const duration =
    Number(
      document.querySelector("#duration")?.value
    );

  const place =
    document.querySelector("#place")?.value.trim();

  if (!date) {
    return alert("Please select a date.");
  }

  if (!time) {
    return alert("Please select a time.");
  }

  if (!place) {
    return alert(
      "Please enter a public meeting place."
    );
  }

  const user = getUser();

  if (!user?.email) {
    return alert(
      "Your registration information could not be found. Please register again."
    );
  }

  const totalAmount = amount * duration;

  try {
    const r = await fetch(
      "/api/create-booking-order",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          name,
          email: user.email,
          phone: user.phone,
          companionName: name,
          activity,
          date,
          time,
          duration,
          place,
          amount: totalAmount
        })
      }
    );

    const order = await r.json();

    if (!r.ok) {
      throw new Error(
        order.error ||
        "Could not create booking order."
      );
    }

    const cfg =
      await fetch("/api/config").then(
        (x) => x.json()
      );

    const rz = new Razorpay({
      key: cfg.keyId,
      amount: order.amount,
      currency: "INR",
      name: "MeraPartner",

      description:
        `Companion booking — ${name}`,

      order_id: order.id,

      prefill: {
        name: user.name,
        email: user.email,
        contact: user.phone
      },

      handler: async function (response) {
        try {
          const vr = await fetch(
            "/api/verify-booking",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                ...response,
                orderId: order.id
              })
            }
          );

          const result = await vr.json();

          if (!vr.ok || !result.verified) {
            throw new Error(
              result.error ||
              "Booking payment verification failed."
            );
          }

          hide();

          alert(
            `Booking request confirmed!\n\n` +
            `Partner: ${name}\n` +
            `Activity: ${activity}\n` +
            `Date: ${date}\n` +
            `Time: ${time}\n` +
            `Duration: ${duration} hour(s)\n` +
            `Amount paid: ₹${totalAmount}\n\n` +
            `Your booking has been saved successfully.`
          );
        } catch (e) {
          alert(e.message);
        }
      },

      theme: {
        color: "#b65243"
      }
    });

    rz.open();
  } catch (e) {
    alert(
      e.message +
      "\n\nPlease try again."
    );
  }
}

document.querySelector("#modal").onclick = (e) => {
  if (e.target.id === "modal") {
    hide();
  }
};

render();
