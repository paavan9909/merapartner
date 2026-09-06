const people = [
  { name: "Aarav", city: "Vadodara", price: 1200, type: "men", tags: ["Coffee", "Events", "Travel"], cls: "" },
  { name: "Riya", city: "Ahmedabad", price: 1500, type: "women", tags: ["Dinner", "Movies", "Art"], cls: "p2" },
  { name: "Kabir", city: "Mumbai", price: 1800, type: "men", tags: ["Fitness", "Food", "Events"], cls: "p3" },
  { name: "Meera", city: "Pune", price: 1400, type: "women", tags: ["Music", "Coffee", "Travel"], cls: "p4" }
];

const REGISTRATION_KEY = "companio_registration_verified";
const cards = document.querySelector("#cards");

function isRegistered() {
  return localStorage.getItem(REGISTRATION_KEY) === "true";
}

function render(f = "all") {
  if (!isRegistered()) {
    cards.innerHTML = `
      <div class="locked">
        <h3>Partners are available after registration</h3>
        <p>Pay the one-time <b>₹300 registration fee</b> to unlock partner profiles and booking requests.</p>
        <button class="book" onclick="showRegistration()">Register for ₹300</button>
      </div>`;
    return;
  }

  cards.innerHTML = people
    .filter((p) => f === "all" || p.type === f)
    .map(
      (p) => `
      <article class="card">
        <div class="photo ${p.cls}"><span>✓ Verified adult</span></div>
        <div class="body">
          <div class="line"><h3>${p.name}</h3><span class="price">₹${p.price}/hr</span></div>
          <div class="meta">${p.city} · Available this week</div>
          <div>${p.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <button class="book" onclick="booking('${p.name}',${p.price})">Request & pay</button>
        </div>
      </article>`
    )
    .join("");
}

document.querySelectorAll("#filters button").forEach((b) =>
  (b.onclick = () => {
    document.querySelectorAll("#filters button").forEach((x) => x.classList.remove("selected"));
    b.classList.add("selected");
    if (!isRegistered()) return showRegistration();
    render(b.dataset.f);
  })
);

function show(kind) {
  const m = document.querySelector("#modal");
  let html = "";
  if (kind === "join") {
    html = `<h2>Become a companion</h2><p>Adults 18+ only. Applications are reviewed before profiles are published.</p><input placeholder="Full name"><input placeholder="Email"><input placeholder="City"><button class="pay" onclick="alert('Demo application submitted.')">Submit application</button>`;
  } else if (kind === "howModal") {
    html = `<h2>How it works</h2><p>Register for ₹300, unlock verified adult companion profiles, choose a social activity and request a booking. Keep first meetings in public places.</p>`;
  }
  document.querySelector("#modalBody").innerHTML = html;
  m.classList.add("show");
}

function showRegistration() {
  const m = document.querySelector("#modal");
  document.querySelector("#modalBody").innerHTML = `
    <h2>Register to discover partners</h2>
    <p class="modal-note">18+ only. A one-time <b>₹300 registration fee</b> is required before partner profiles and booking requests are unlocked.</p>
    <input id="regName" placeholder="Full name" autocomplete="name" />
    <input id="regEmail" placeholder="Email address" type="email" autocomplete="email" />
    <input id="regPhone" placeholder="Mobile number" type="tel" autocomplete="tel" />
    <label class="age-check"><input id="regAge" type="checkbox" /> I confirm that I am 18 or older.</label>
    <button class="pay" onclick="payRegistration()">Pay ₹300 & unlock partners</button>
    <small>Payment is processed securely by Razorpay. Do not enter payment details into this website.</small>`;
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

  if (!name || !email || !phone) return alert("Please enter your name, email and mobile number.");
  if (!age) return alert("You must confirm that you are 18 or older.");

  try {
    const cfg = await fetch("/api/config").then((r) => r.json());
    if (!cfg.keyId) throw new Error("Razorpay is not configured yet. Add the Razorpay keys in Vercel first.");

    const r = await fetch("/api/create-registration-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone })
    });
    const order = await r.json();
    if (!r.ok) throw new Error(order.error || "Could not create registration order.");

    const rz = new Razorpay({
      key: cfg.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "MeraPartner",
      description: "One-time registration fee",
      order_id: order.id,
      prefill: { name, email, contact: phone },
      handler: async function (response) {
        try {
          const vr = await fetch("/api/verify-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response)
          });
          const result = await vr.json();
          if (!vr.ok || !result.verified) throw new Error(result.error || "Payment verification failed.");

          localStorage.setItem(REGISTRATION_KEY, "true");
          hide();
          render();
          alert("Registration successful. Partner profiles are now unlocked.");
        } catch (e) {
          alert(e.message);
        }
      },
      modal: { ondismiss: function () {} },
      theme: { color: "#b65243" }
    });

    rz.open();
  } catch (e) {
    alert(e.message);
  }
}

async function booking(name, amount) {
  if (!isRegistered()) return showRegistration();
  show();
  document.querySelector("#modalBody").innerHTML = `<h2>Book ${name}</h2><p>Rate: ₹${amount}/hr</p><select id="activity"><option>Coffee & conversation</option><option>Dinner</option><option>Movie / event</option><option>City activity</option></select><input id="date" type="date"><input id="time" type="time"><input id="place" placeholder="Public meeting place"><button class="pay" onclick="pay('${name}',${amount})">Continue to secure payment</button>`;
}

async function pay(name, amount) {
  try {
    const r = await fetch("/api/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
    const order = await r.json();
    if (!r.ok) throw new Error(order.error || "Could not create order");
    const cfg = await fetch("/api/config").then((x) => x.json());
    const rz = new Razorpay({ key: cfg.keyId, amount: order.amount, currency: "INR", name: "MeraPartner", description: `Companion booking — ${name}`, order_id: order.id, handler: function () { alert("Payment received. Booking confirmation will be added after final payment verification and database setup."); hide(); }, theme: { color: "#b65243" } });
    rz.open();
  } catch (e) {
    alert(e.message + "\n\nAdd your Razorpay TEST keys in Vercel to enable payments.");
  }
}

document.querySelector("#modal").onclick = (e) => { if (e.target.id === "modal") hide(); };
render();
