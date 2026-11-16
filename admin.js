const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const configured = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase);
const db = configured ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;

function message(text, isError = false, target = "#admin-message") {
  const element = $(target);
  element.textContent = text;
  element.className = isError ? "admin-error" : "admin-success";
}

function resetEventForm() {
  $("#event-form").reset();
  $("#event-id").value = "";
  $("#event-fee").value = "0";
  $("#event-open").checked = true;
  $("#event-published").checked = true;
  $("#event-form-heading").textContent = "Create an event";
  $("#save-event").textContent = "Create event";
  $("#cancel-edit").hidden = true;
}

$("#event-fee-field").hidden = !CONFIG.registrationFeesEnabled;
$("#event-fee").required = CONFIG.registrationFeesEnabled;
$("#payment-reference-heading").hidden = !CONFIG.registrationFeesEnabled;

function editEvent(event) {
  $("#event-id").value = event.id;
  $("#event-title").value = event.title;
  $("#event-date").value = event.event_date;
  $("#event-time").value = event.event_time || "";
  $("#event-category").value = event.category;
  $("#event-fee").value = event.fee;
  $("#event-venue").value = event.venue;
  $("#event-description").value = event.description;
  $("#event-open").checked = event.is_open;
  $("#event-published").checked = event.is_published;
  $("#event-form-heading").textContent = "Edit event";
  $("#save-event").textContent = "Save changes";
  $("#cancel-edit").hidden = false;
  $("#event-form").scrollIntoView({ behavior: "smooth" });
}

async function loadDashboard() {
  const [eventsResult, registrationsResult] = await Promise.all([
    db.from("events").select("*").order("event_date"),
    db.from("registrations").select("*").order("created_at", { ascending: false })
  ]);
  if (eventsResult.error || registrationsResult.error) {
    const failure = eventsResult.error || registrationsResult.error;
    message("Could not load the admin data: " + failure.message, true);
    return;
  }
  $("#events-list").innerHTML = eventsResult.data.length ? eventsResult.data.map(event => `
    <article class="card admin-event">
      <div><h3>${esc(event.title)}</h3><p class="mu">${esc(event.event_date)}${event.event_time ? " · " + esc(event.event_time) : ""} · ${esc(event.venue)}</p>
      <p>${esc(event.category)}${CONFIG.registrationFeesEnabled ? " · " + (Number(event.fee) ? "Fee ₹" + esc(event.fee) : "Free") : ""} · ${event.is_open ? "Registration open" : "Registration closed"} · ${event.is_published ? "Published" : "Hidden"}</p></div>
      <div class="row"><button class="btn o" type="button" data-edit="${esc(event.id)}">Edit</button><button class="btn danger" type="button" data-delete="${esc(event.id)}">Delete</button></div>
    </article>`).join("") : '<p class="mu">No events yet. Create one above.</p>';
  $("#registrations-list").innerHTML = registrationsResult.data.length ? registrationsResult.data.map(registration => `
    <tr><td data-label="Registered">${esc(new Date(registration.created_at).toLocaleString())}</td><td data-label="Event">${esc(registration.event_title)}<br>${esc(registration.event_date)}</td>
    <td data-label="Reference">${esc(registration.ref)}</td><td data-label="Name">${esc(registration.full_name)}</td><td data-label="Phone">${esc(registration.phone)}</td><td data-label="Email">${esc(registration.email)}</td><td data-label="Age">${esc(registration.age)}</td>
    <td data-label="City">${esc(registration.city)}</td>${CONFIG.registrationFeesEnabled ? `<td data-label="Payment reference">${esc(registration.transaction_id)}</td>` : ""}<td data-label="Note">${esc(registration.note)}</td></tr>`).join("") : `<tr><td colspan="${CONFIG.registrationFeesEnabled ? 10 : 9}">No registrations yet.</td></tr>`;

  $("#events-list").querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const event = eventsResult.data.find(item => item.id === button.dataset.edit);
      if (event) editEvent(event);
    });
  });
  $("#events-list").querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const event = eventsResult.data.find(item => item.id === button.dataset.delete);
      if (!event || !window.confirm(`Delete "${event.title}"? Existing registration records will be kept.`)) return;
      const { error } = await db.from("events").delete().eq("id", event.id);
      if (error) message("Could not delete the event: " + error.message, true);
      else {
        message("Event deleted. Existing registrations remain available.");
        await loadDashboard();
      }
    });
  });
}

async function showAdmin() {
  const { data, error } = await db.rpc("is_foundation_admin");
  if (error || !data) {
    await db.auth.signOut();
    $("#dashboard").hidden = true;
    $("#login-section").hidden = false;
    message(error ? "Could not verify admin access: " + error.message : "This account is not authorized to manage the website.", true, "#login-message");
    return;
  }
  $("#login-section").hidden = true;
  $("#dashboard").hidden = false;
  await loadDashboard();
}

if (!configured) {
  $("#login-section").hidden = true;
  message("Admin setup is incomplete. Add your Supabase project URL and publishable/anon key to js/config.js.", true, "#login-message");
} else {
  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    message("Signing in…", false, "#login-message");
    const { error } = await db.auth.signInWithPassword({
      email: $("#login-email").value.trim(),
      password: $("#login-password").value
    });
    if (error) message("Sign-in failed: " + error.message, true, "#login-message");
    else await showAdmin();
  });

  $("#event-form").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("#event-id").value;
    const eventData = {
      title: $("#event-title").value.trim(),
      event_date: $("#event-date").value,
      event_time: $("#event-time").value.trim() || null,
      category: $("#event-category").value.trim(),
      fee: CONFIG.registrationFeesEnabled ? Number($("#event-fee").value) : 0,
      venue: $("#event-venue").value.trim(),
      description: $("#event-description").value.trim(),
      is_open: $("#event-open").checked,
      is_published: $("#event-published").checked
    };
    const result = id
      ? await db.from("events").update(eventData).eq("id", id)
      : await db.from("events").insert(eventData);
    if (result.error) {
      message("Could not save the event: " + result.error.message, true);
      return;
    }
    resetEventForm();
    message(id ? "Event updated." : "Event created.");
    await loadDashboard();
  });

  $("#cancel-edit").addEventListener("click", resetEventForm);
  $("#logout-button").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();
    if (error) message("Could not sign out: " + error.message, true);
    else {
      $("#dashboard").hidden = true;
      $("#login-section").hidden = false;
      message("Signed out.", false, "#login-message");
    }
  });
  db.auth.getSession().then(({ data, error }) => {
    if (error) message("Could not check the sign-in session: " + error.message, true, "#login-message");
    else if (data.session) showAdmin();
  });
}
