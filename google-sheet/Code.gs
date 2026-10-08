/**
 * Santa Paws sign-up sheet.
 *
 * Paste this into Extensions > Apps Script in a Google Sheet, set NOTIFY_EMAIL,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into SHEET_URL on the website.
 *
 * What it does:
 *  - Records photo bookings, vendor applications and contact messages in tabs.
 *  - Refuses a photo time that's already booked, and vendor applications once 15 are in.
 *  - Emails you each sign-up, and emails the person a confirmation.
 *  - Tells the website which photo times are taken, how many vendor spots are left,
 *    and which sponsors to show (from the Sponsors tab, which you fill in by hand).
 *
 * To free a photo time or vendor spot, delete that row. People can also cancel
 * their own booking or application with the link in their confirmation email.
 *
 * After changing this script: Deploy > Manage deployments > pencil icon >
 * Version: New version > Deploy. The web app URL stays the same.
 */

const NOTIFY_EMAIL = "you@example.com";   // where sign-ups are sent (never shown on the site)
const VENDOR_MAX = 15;
const SITE = "https://cvahsantapaws.com";
const SPONSOR_LEVELS = { "North Pole": 3, "Reindeer": 5, "Elf Friends": 7 };

const TABS = {
  photos: ["Submitted", "Times", "First name", "Last name", "Phone", "Email", "Pets", "Pet details", "Notes", "Cancel code"],
  vendors: ["Submitted", "Business", "Contact", "Email", "Phone", "Category", "Website or social", "Booth needs", "Description", "Cancel code"],
  messages: ["Submitted", "Name", "Email", "Phone", "Topic", "Message"],
  sponsors: ["Business", "Level (North Pole, Reindeer or Elf Friends)", "Show on website (Yes/No)"],
};
const TAB_NAMES = { photos: "Photo bookings", vendors: "Vendors", messages: "Messages", sponsors: "Sponsors" };

function tab_(key) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(TAB_NAMES[key]);
  if (!sh) {
    sh = ss.insertSheet(TAB_NAMES[key]);
    sh.appendRow(TABS[key]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[key].length).setFontWeight("bold");
  } else if (sh.getLastColumn() < TABS[key].length) {
    sh.getRange(1, 1, 1, TABS[key].length).setValues([TABS[key]]).setFontWeight("bold");
  }
  return sh;
}

function rows_(key) {
  const sh = tab_(key);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, TABS[key].length).getValues() : [];
}

function status_() {
  const booked = [];
  rows_("photos").forEach(r => String(r[1]).split(",").map(t => t.trim()).filter(Boolean).forEach(t => booked.push(t)));
  const vendorsTaken = rows_("vendors").filter(r => r[1]).length;
  const sponsors = {};
  Object.keys(SPONSOR_LEVELS).forEach(l => (sponsors[l] = []));
  rows_("sponsors").forEach(r => {
    const level = Object.keys(SPONSOR_LEVELS).find(l => String(r[1]).toLowerCase().indexOf(l.toLowerCase()) === 0);
    if (r[0] && level) sponsors[level].push({ name: String(r[0]), show: String(r[2]).toLowerCase() !== "no" });
  });
  const levels = {};
  Object.keys(SPONSOR_LEVELS).forEach(l => (levels[l] = { max: SPONSOR_LEVELS[l], taken: sponsors[l].length, names: sponsors[l].filter(s => s.show).map(s => s.name) }));
  return { booked: booked, vendors: { max: VENDOR_MAX, taken: vendorsTaken }, sponsors: levels };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function mail_(to, subject, body, replyTo) {
  if (!to) return;
  const opts = { to: to, subject: subject, body: body, name: "Santa Paws" };
  if (replyTo) opts.replyTo = replyTo;
  try { MailApp.sendEmail(opts); } catch (err) { console.error(err); }
}

function newCode_() {
  return Utilities.getUuid().replace(/-/g, "");
}

// Finds a photo booking or vendor application by its cancel code.
function findByCode_(code) {
  if (!code) return null;
  for (const key of ["photos", "vendors"]) {
    const rows = rows_(key), col = TABS[key].length - 1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][col]) === String(code)) return { key: key, row: i + 2, values: rows[i] };
    }
  }
  return null;
}

function describe_(hit) {
  const v = hit.values;
  return hit.key === "photos"
    ? { kind: "photo", times: String(v[1]), name: `${v[2]} ${v[3]}`, email: String(v[5]), pets: String(v[7]) }
    : { kind: "vendor", name: String(v[1]), contact: String(v[2]), email: String(v[3]) };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.lookup) {
    const hit = findByCode_(p.lookup);
    return json_(hit ? Object.assign({ ok: true }, describe_(hit)) : { ok: false });
  }
  return json_(status_());
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const now = new Date();
    if (p.form === "cancel") {
      const hit = findByCode_(p.code);
      if (!hit) return json_({ ok: false, reason: "not_found" });
      const d = describe_(hit);
      tab_(hit.key).deleteRow(hit.row);
      if (d.kind === "photo") {
        mail_(NOTIFY_EMAIL, `Cancelled Santa photo: ${d.name} at ${d.times}`, `${d.name} cancelled their Santa photo at ${d.times}. That time is open again.`);
        mail_(d.email, "Your Santa Paws photo time is cancelled", `Your Santa photo at ${d.times} has been cancelled. If you change your mind, you can book a new time at ${SITE}/photos.html.\n\nSanta Paws`);
      } else {
        mail_(NOTIFY_EMAIL, `Vendor withdrew: ${d.name}`, `${d.name} (${d.contact}) withdrew their vendor application. That spot is open again.`);
        mail_(d.email, "Your Santa Paws vendor application is withdrawn", `Your vendor application for ${d.name} has been withdrawn.\n\nSanta Paws`);
      }
      return json_(Object.assign({ ok: true, status: status_() }, d));
    }
    if (p.form === "photo") {
      const times = String(p.times || "").split(",").map(t => t.trim()).filter(Boolean);
      if (!times.length) return json_({ ok: false, reason: "missing" });
      const booked = status_().booked;
      const taken = times.filter(t => booked.indexOf(t) !== -1);
      if (taken.length) return json_({ ok: false, reason: "taken", taken: taken, status: status_() });
      const count = Number(p.pet_count || 1);
      const pets = [];
      for (let i = 1; i <= count; i++) pets.push(`${p["pet" + i + "_name"] || "?"} (${p["pet" + i + "_type"] || "?"})`);
      const code = newCode_();
      tab_("photos").appendRow([now, times.join(", "), p.first_name, p.last_name, p.phone, p.email, count, pets.join(", "), p.notes || "", code]);
      const who = `${p.first_name} ${p.last_name}`;
      mail_(NOTIFY_EMAIL, `Santa photo booking: ${who} at ${times.join(", ")}`,
        `${who} booked ${times.join(", ")}.\n\nPets: ${pets.join(", ")}\nPhone: ${p.phone}\nEmail: ${p.email}\nNotes: ${p.notes || "-"}`, p.email);
      mail_(p.email, "Your Santa Paws photo time is booked!",
        `Hi ${p.first_name},\n\nYou're booked for Santa photos at ${times.join(", ")} on Saturday, November 21, 2026.\n` +
        `Pets: ${pets.join(", ")}\n\nPhotos are taken at River Rye Shoppe, beside Carolina Virginia Animal Hospital, 46 Shady Grove Road, Providence, NC.\n` +
        `Photos are free, and we'll email you a link to download them when they're ready.\n\n` +
        `Can't make it? Please release your time so another family can use it:\n${SITE}/cancel.html?code=${code}\n\nSee you there!\nSanta Paws`);
      return json_({ ok: true, status: status_() });
    }
    if (p.form === "vendor") {
      const st = status_();
      if (st.vendors.taken >= VENDOR_MAX) return json_({ ok: false, reason: "full", status: st });
      const code = newCode_();
      tab_("vendors").appendRow([now, p.business, p.contact, p.email, p.phone, p.category, p.website, p.needs || "", p.description, code]);
      mail_(NOTIFY_EMAIL, `Vendor application: ${p.business}`,
        `${p.business} (${p.contact}) applied for a vendor spot.\n\nCategory: ${p.category}\nEmail: ${p.email}\nPhone: ${p.phone}\nWebsite: ${p.website}\nNeeds: ${p.needs || "-"}\n\n${p.description || ""}`, p.email);
      mail_(p.email, "We got your Santa Paws vendor application",
        `Hi ${p.contact},\n\nThanks for applying to be a vendor at Santa Paws on Saturday, November 21, 2026. We'll review your application and follow up by email.\n\nIf you can no longer attend, you can withdraw here so another vendor can have the spot:\n${SITE}/cancel.html?code=${code}\n\nSanta Paws\nCarolina Virginia Animal Hospital`);
      return json_({ ok: true, status: status_() });
    }
    if (p.form === "contact") {
      tab_("messages").appendRow([now, p.name, p.email, p.phone, p.topic, p.message]);
      mail_(NOTIFY_EMAIL, `Santa Paws message: ${p.topic}`, `From ${p.name} (${p.email}${p.phone ? ", " + p.phone : ""})\n\n${p.message}`, p.email);
      return json_({ ok: true });
    }
    return json_({ ok: false, reason: "unknown form" });
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor to create the tabs and approve email access. */
function setup() {
  Object.keys(TABS).forEach(tab_);
  console.log(JSON.stringify(status_()));
}
