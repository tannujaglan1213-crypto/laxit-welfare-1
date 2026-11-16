// ===== EDIT THIS FILE to change events and registration settings =====

const CONFIG = {
  whatsapp: "919728783006",                         // number with country code, no + or spaces
  email: "laxitwelfarefoundation@gmail.com",
  registrationFeesEnabled: false,                  // set true to show event fees and payment fields
  supabaseUrl: "https://gujoehudbpqqbkwkpsus.supabase.co",                                // Supabase project URL
  supabaseAnonKey: "sb_publishable_TMbK_PIYvTBDrCzL5aUrbQ_blqk1MSh",                              // Supabase publishable/anon key (never use a service-role key here)
  upi: "",                                          // your UPI ID for paid events, e.g. name@bank
  formEndpoint: ""                                  // optional: Formspree / Google Apps Script URL that saves registrations
};

// Add, edit or remove events. Date format: YYYY-MM-DD.
// Events whose date has passed move to "Past activities" automatically.
// fee: 0 means free. open: false hides the Register button.
const LOCAL_EVENTS = [
  {
    id: "education-paper-2026",
    title: "Education Paper Prize Distribution",
    date: "2026-11-15",
    time: "",
    venue: "Chulkana, Samalkha (Panipat)",
    category: "Education",
    fee: 0,
    open: true,
    desc: "Prize distribution for the Education Paper. First prize ₹3100, second prize ₹2100, third prize ₹1100. Register to attend."
  }
];
