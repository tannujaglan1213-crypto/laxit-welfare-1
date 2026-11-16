// Page behaviour: shows events from config.js and handles the registration form.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayStr = () => new Date().toISOString().slice(0, 10);
const isUpcoming = e => e.date >= todayStr();
const longDate = d => new Date(d + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const backendConfigured = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase);
const db = backendConfigured ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
let EVENTS = [...LOCAL_EVENTS];

function eventCard(e) {
  const d = new Date(e.date + "T00:00"), up = isUpcoming(e);
  return `<article class="ev"><div class="dt"><b>${d.getDate()}</b>${d.toLocaleString("en-IN", { month: "short" })}</div><div>
    <span class="badge ${up ? "" : "p"}">${up ? "Upcoming" : "Completed"}</span> <span class="mu">${esc(e.category)}</span>
    <h3>${esc(e.title)}</h3>
    <p class="mu">${esc(longDate(e.date))}${e.time ? " · " + esc(e.time) : ""} · ${esc(e.venue)}${CONFIG.registrationFeesEnabled ? " · " + (+e.fee ? "Fee ₹" + esc(e.fee) : "Free entry") : ""}</p>
    <p>${esc(e.desc)}</p>
    ${up && e.open !== false ? `<button class="btn g sm" onclick="openReg('${esc(e.id)}')">Register</button>` : ""}</div></article>`;
}

async function renderEvents() {
  if (backendConfigured) {
    const { data, error } = await db.from("events")
      .select("id,title,event_date,event_time,venue,category,fee,is_open,description")
      .order("event_date");
    if (error) {
      console.error("Could not load events:", error.message);
      $("#events-upcoming").innerHTML = '<p class="mu">Activities could not be loaded right now. Please try again later.</p>';
      $("#events-past").innerHTML = "";
      $("#next-event").innerHTML = "";
      return;
    }
    EVENTS = data.map(e => ({
      id: e.id, title: e.title, date: e.event_date, time: e.event_time || "",
      venue: e.venue, category: e.category, fee: CONFIG.registrationFeesEnabled ? e.fee : 0, open: e.is_open, desc: e.description
    }));
  }
  const sorted = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  const up = sorted.filter(isUpcoming), past = sorted.filter(e => !isUpcoming(e)).reverse();
  $("#events-upcoming").innerHTML = up.length ? up.map(eventCard).join("") : '<p class="mu">New activities will be announced soon.</p>';
  $("#events-past").innerHTML = past.length ? past.map(eventCard).join("") : '<p class="mu">Past activities will appear here.</p>';
  const next = up[0];
  $("#next-event").innerHTML = next ? `<div class="next"><div class="eb">Next event</div><h3>${esc(next.title)}</h3><p class="mu">${esc(longDate(next.date))}<br>${esc(next.venue)}</p>${next.open !== false ? `<button class="btn" onclick="openReg('${esc(next.id)}')">Register now</button>` : ""}</div>` : "";
}

function openReg(id) {
  const e = EVENTS.find(x => x.id === id), fee = CONFIG.registrationFeesEnabled ? +e.fee : 0;
  $("#modal").innerHTML = `<div class="modal"><div>
    <h2>Register: ${esc(e.title)}</h2><p class="mu">${esc(longDate(e.date))}${CONFIG.registrationFeesEnabled ? " · " + (fee ? "Fee ₹" + fee : "Free") : ""}</p>
    <label>Full name *</label><input id="f_name"><label>Mobile number *</label><input id="f_phone" type="tel">
    <label>Email</label><input id="f_email" type="email"><label>Age</label><input id="f_age" type="number">
    <label>Village / City</label><input id="f_city"><label>Anything else</label><textarea id="f_note" rows="2"></textarea>
    ${fee ? `<div class="note">Pay ₹${fee} ${CONFIG.upi ? `to UPI <b>${esc(CONFIG.upi)}</b> (<a href="upi://pay?pa=${esc(CONFIG.upi)}&pn=Laxit%20Welfare%20Foundation&am=${fee}&cu=INR">open UPI app</a>)` : "as told by the foundation"}, then enter the transaction ID.</div><label>UPI transaction ID *</label><input id="f_txn">` : ""}
    <p id="f_msg" style="color:#c0392b"></p>
    <button class="btn" onclick="submitReg('${esc(id)}')">Submit</button> <button class="btn o" onclick="closeModal()">Cancel</button></div></div>`;
}
const closeModal = () => { $("#modal").innerHTML = ""; };

async function submitReg(id) {
  const e = EVENTS.find(x => x.id === id), g = k => ($("#f_" + k) || { value: "" }).value.trim();
  const r = { event: e.title, date: e.date, name: g("name"), phone: g("phone"), email: g("email"), age: g("age"), city: g("city"), note: g("note"), txn: g("txn"), fee: e.fee };
  const err = m => { $("#f_msg").textContent = m; };
  if (!r.name || r.phone.replace(/\D/g, "").length < 10) return err("Please enter your name and a 10-digit mobile number.");
  if (+e.fee && !r.txn) return err("Please enter the payment transaction ID.");
  const ref = "LWF" + Date.now().toString(36).toUpperCase();
  let saved = false;
  if (backendConfigured) {
    const { error } = await db.from("registrations").insert({
      ref, event_id: e.id, full_name: r.name, phone: r.phone, email: r.email || null,
      age: r.age ? Number(r.age) : null, city: r.city || null, note: r.note || null,
        ...(CONFIG.registrationFeesEnabled ? { transaction_id: r.txn || null } : {})
    });
    if (error) return err("We couldn't save your registration. Please try again or contact the foundation. " + error.message);
    saved = true;
  } else if (CONFIG.formEndpoint) {
    try { saved = (await fetch(CONFIG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ ref, ...r }) })).ok; } catch { saved = false; }
  }
  const text = `Hello Laxit Welfare Foundation, I want to register for ${e.title} (${e.date}).\nName: ${r.name}\nMobile: ${r.phone}\nAge: ${r.age}\nCity: ${r.city}\nRef: ${ref}${+e.fee ? "\nUPI Txn ID: " + r.txn : ""}`;
  $("#modal").innerHTML = `<div class="modal"><div><h2>Almost done</h2><p>Thank you, <b>${esc(r.name)}</b>. Your reference is <b>${ref}</b>.</p>
    ${saved ? '<p class="note">Your details were saved.</p>' : ""}
    <p class="note">Please send your details to the foundation so we can confirm your seat.</p>
    <p><a class="btn s" target="_blank" href="https://wa.me/${esc(CONFIG.whatsapp)}?text=${encodeURIComponent(text)}">Send on WhatsApp</a></p>
    <p><a class="btn o" href="mailto:${esc(CONFIG.email)}?subject=${encodeURIComponent("Registration " + ref)}&body=${encodeURIComponent(text)}">Send by email</a></p>
    <button class="btn" onclick="closeModal()">Close</button></div></div>`;
}

function toggleTheme() {
  const d = document.documentElement, dark = d.dataset.theme ? d.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
  d.dataset.theme = dark ? "light" : "dark";
}
renderEvents();
