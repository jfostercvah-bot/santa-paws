/**
 * Santa Paws sign-up service.
 *
 * Public API (used by the website):
 *   GET  /                 -> { booked, vendors: {max, taken, list}, sponsors: {level: {max, taken, names, list}} }
 *   GET  /logo/vendor/ID, /logo/sponsor/ID -> the logo image (only once shown on the website)
 *   GET  /?lookup=CODE     -> what a cancel code refers to
 *   POST / form=photo|vendor|sponsor|contact|cancel -> { ok, reason?, taken?, code?, status? }
 *   POST / form=find (email, phone)   -> { ok, bookings: [{kind, times|name, code}] }
 *
 * Admin API (Authorization: Bearer ADMIN_PASSWORD), used by admin.html:
 *   GET  /admin            -> every table
 *   POST /admin/delete     { table, id }
 *   POST /admin/sponsor    { business, level, show }  (with id to update)
 *   POST /admin/show       { table: vendors|sponsors, id, show }
 *   POST /admin/email      { audience: photos|vendors|everyone|test, subject, message }
 *
 * Email goes out through Resend when the RESEND_API_KEY and REPLY_TO_EMAIL secrets are set:
 * a confirmation to each person who books or applies, and announcements from the admin page.
 */

const VENDOR_MAX = 15;
const SPONSOR_LEVELS = { "North Pole": 3, Reindeer: 5, "Elf Friends": 7 };
const MAX_PETS = 6;

// Every bookable photo time: each 5 minutes, 10:00-11:55 AM and 1:00-2:55 PM.
const SLOTS = new Set();
for (const [from, to] of [[600, 720], [780, 900]]) {
  for (let m = from; m < to; m += 5) {
    const h = Math.floor(m / 60);
    SLOTS.add(`${h > 12 ? h - 12 : h}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`);
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

// Trimmed form field, capped so nobody can stuff the database.
const field = (p, k, max = 200) => String(p[k] ?? "").trim().slice(0, max);

// "10:05", "10:05 am" or "1:30PM" -> "10:05 AM" / "1:30 PM"
function normTime(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
  if (!m) return "";
  const h = Number(m[1]);
  const ap = m[3] ? m[3].toUpperCase() : h >= 10 && h < 12 ? "AM" : "PM";
  return `${h}:${m[2]} ${ap}`;
}

// Logos arrive as small data: URLs (the page resizes them first).
const MAX_LOGO = 400000;
function logoField(p) {
  const v = String(p.logo || "");
  return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_LOGO ? v : "";
}

const newCode = () => crypto.randomUUID().replace(/-/g, "");

async function status(db) {
  const [slots, vendors, shown, sponsors] = await db.batch([
    db.prepare("SELECT time FROM photo_slots"),
    db.prepare("SELECT COUNT(*) AS n FROM vendors"),
    db.prepare("SELECT id, business, category, description, website, logo != '' AS has_logo FROM vendors WHERE show = 1 ORDER BY business COLLATE NOCASE"),
    db.prepare("SELECT id, business, level, show, website, logo != '' AS has_logo FROM sponsors ORDER BY id"),
  ]);
  const levels = {};
  for (const [level, max] of Object.entries(SPONSOR_LEVELS)) {
    const rows = sponsors.results.filter(s => s.level === level), visible = rows.filter(s => s.show);
    levels[level] = {
      max, taken: rows.length, names: visible.map(s => s.business),
      list: visible.map(s => ({ name: s.business, website: s.website, logo: s.has_logo ? `/logo/sponsor/${s.id}` : "" })),
    };
  }
  return {
    booked: slots.results.map(r => r.time),
    vendors: {
      max: VENDOR_MAX, taken: vendors.results[0].n,
      list: shown.results.map(v => ({ name: v.business, category: v.category, description: v.description, website: v.website, logo: v.has_logo ? `/logo/vendor/${v.id}` : "" })),
    },
    sponsors: levels,
  };
}

async function lookup(db, code) {
  if (!code) return null;
  const photo = await db.prepare("SELECT * FROM photos WHERE code = ?").bind(code).first();
  if (photo) return { table: "photos", row: photo, info: { kind: "photo", times: photo.times, name: `${photo.first_name} ${photo.last_name}`, pets: photo.pets } };
  const vendor = await db.prepare("SELECT * FROM vendors WHERE code = ?").bind(code).first();
  if (vendor) return { table: "vendors", row: vendor, info: { kind: "vendor", name: vendor.business, contact: vendor.contact } };
  return null;
}

async function bookPhoto(db, p) {
  const times = [...new Set(field(p, "times", 200).split(",").map(normTime).filter(Boolean))];
  const first = field(p, "first_name", 80), last = field(p, "last_name", 80);
  const phone = field(p, "phone", 40), email = field(p, "email", 120);
  if (!times.length || !first || !last || !phone || !email) return { ok: false, reason: "missing" };
  if (times.some(t => !SLOTS.has(t)) || times.length > 3) return { ok: false, reason: "bad_time" };
  const count = Math.min(MAX_PETS, Math.max(1, Number(p.pet_count) || 1));
  const pets = [];
  for (let i = 1; i <= count; i++) pets.push(`${field(p, `pet${i}_name`, 60) || "?"} (${field(p, `pet${i}_type`, 10) || "?"})`);

  const taken = (await db.prepare(`SELECT time FROM photo_slots WHERE time IN (${times.map(() => "?").join(",")})`).bind(...times).all()).results.map(r => r.time);
  if (taken.length) return { ok: false, reason: "taken", taken, status: await status(db) };

  // One transaction: if any slot was grabbed in the meantime, the primary key fails and nothing is saved.
  const code = newCode();
  try {
    await db.batch([
      db.prepare("INSERT INTO photos (times, first_name, last_name, phone, email, pet_count, pets, notes, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(times.join(", "), first, last, phone, email, count, pets.join(", "), field(p, "notes", 1000), code),
      ...times.map(t => db.prepare("INSERT INTO photo_slots (time, photo_id) VALUES (?, (SELECT id FROM photos WHERE code = ?))").bind(t, code)),
    ]);
  } catch (err) {
    if (/UNIQUE|constraint/i.test(String(err))) {
      const st = await status(db);
      return { ok: false, reason: "taken", taken: times.filter(t => st.booked.includes(t)), status: st };
    }
    throw err;
  }
  return { ok: true, code, times, pets: pets.join(", "), status: await status(db) };
}

async function applyVendor(db, p) {
  const business = field(p, "business", 120), contact = field(p, "contact", 120), email = field(p, "email", 120);
  if (!business || !contact || !email) return { ok: false, reason: "missing" };
  const code = newCode();
  // The count check and insert are one statement, so two last-minute applications can't both get spot 15.
  const r = await db.prepare(
    `INSERT INTO vendors (business, contact, email, phone, category, website, needs, description, logo, code)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM vendors) < ?`)
    .bind(business, contact, email, field(p, "phone", 40), field(p, "category", 80), field(p, "website", 200),
      field(p, "needs", 500), field(p, "description", 2000), logoField(p), code, VENDOR_MAX)
    .run();
  if (!r.meta.changes) return { ok: false, reason: "full", status: await status(db) };
  return { ok: true, code, status: await status(db) };
}

// Sponsor sign-ups hold a spot right away; they show on the website once approved on the admin page.
async function applySponsor(db, p) {
  const business = field(p, "business", 120), contact = field(p, "contact", 120), email = field(p, "email", 120), level = field(p, "level", 40);
  if (!business || !contact || !email || !(level in SPONSOR_LEVELS)) return { ok: false, reason: "missing" };
  const r = await db.prepare(
    `INSERT INTO sponsors (business, level, show, contact, email, phone, website, logo)
     SELECT ?, ?, 0, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM sponsors WHERE level = ?) < ?`)
    .bind(business, level, contact, email, field(p, "phone", 40), field(p, "website", 200), logoField(p), level, SPONSOR_LEVELS[level])
    .run();
  if (!r.meta.changes) return { ok: false, reason: "full", status: await status(db) };
  return { ok: true, status: await status(db) };
}

async function logo(db, kind, id) {
  const table = { vendor: "vendors", sponsor: "sponsors" }[kind];
  const row = table && (await db.prepare(`SELECT logo FROM ${table} WHERE id = ? AND show = 1`).bind(id).first());
  const m = row && String(row.logo).match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404, headers: CORS });
  const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  return new Response(bytes, { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600", ...CORS } });
}

async function saveMessage(db, p) {
  const name = field(p, "name", 120), email = field(p, "email", 120), message = field(p, "message", 5000);
  if (!name || !email || !message) return { ok: false, reason: "missing" };
  await db.prepare("INSERT INTO messages (name, email, phone, topic, message) VALUES (?, ?, ?, ?, ?)")
    .bind(name, email, field(p, "phone", 40), field(p, "topic", 80), message).run();
  return { ok: true };
}

// Last 10 digits, so "(555) 123-4567" and "+1 555.123.4567" match.
const digits = s => String(s).replace(/\D/g, "").slice(-10);

// Lets people find their own bookings with the email and phone they signed up with.
async function find(db, p) {
  const email = field(p, "email", 120).toLowerCase(), phone = digits(field(p, "phone", 40));
  if (!email || phone.length < 7) return { ok: false, reason: "missing" };
  const [photos, vendors] = await db.batch([
    db.prepare("SELECT times, first_name, last_name, phone, code FROM photos WHERE lower(email) = ?").bind(email),
    db.prepare("SELECT business, phone, code FROM vendors WHERE lower(email) = ?").bind(email),
  ]);
  const bookings = [
    ...photos.results.filter(r => digits(r.phone) === phone).sort((a, b) => minutes(a.times) - minutes(b.times))
      .map(r => ({ kind: "photo", times: r.times, name: `${r.first_name} ${r.last_name}`, code: r.code })),
    ...vendors.results.filter(r => digits(r.phone) === phone).map(r => ({ kind: "vendor", name: r.business, code: r.code })),
  ];
  return { ok: true, bookings };
}

const minutes = t => {
  const m = String(t).match(/(\d+):(\d+)\s*([AP]M)/i);
  return m ? (Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]) : 9999;
};

async function cancel(db, code) {
  const hit = await lookup(db, code);
  if (!hit) return { ok: false, reason: "not_found" };
  await removeRow(db, hit.table, hit.row.id);
  return { ok: true, ...hit.info, status: await status(db) };
}

async function removeRow(db, table, id) {
  if (table === "photos") {
    await db.batch([
      db.prepare("DELETE FROM photo_slots WHERE photo_id = ?").bind(id),
      db.prepare("DELETE FROM photos WHERE id = ?").bind(id),
    ]);
  } else {
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  }
}

// ---- admin ----

// ---- email (Resend) ----

const SITE = "https://cvahsantapaws.com";
const FROM = "Santa Paws <hello@cvahsantapaws.com>";
const emailReady = env => Boolean(env.RESEND_API_KEY && env.REPLY_TO_EMAIL);
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const looksLikeEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function letter(to, subject, text, env) {
  const footer = `\n\nSanta Paws · Saturday, November 21, 2026 · 46 Shady Grove Road, Providence, NC\nHosted by Carolina Virginia Animal Hospital · ${SITE}`;
  const body = text + footer;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1d2a24;max-width:560px">` +
    body.split(/\n{2,}/).map(par => `<p>${escapeHtml(par).replace(/\n/g, "<br>")}</p>`).join("") + `</div>`;
  return { from: FROM, to: [to], reply_to: env.REPLY_TO_EMAIL, subject, text: body, html };
}

// Sends one email per person (nobody sees anyone else's address), 100 per request.
async function sendEmails(env, letters) {
  let sent = 0, failed = 0, error = "";
  for (let i = 0; i < letters.length; i += 100) {
    const chunk = letters.slice(i, i + 100);
    const r = await fetch(env.RESEND_URL || "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (r.ok) sent += chunk.length;
    else {
      failed += chunk.length;
      const raw = await r.text();
      try { error = JSON.parse(raw).message || raw; } catch { error = raw; }
      error = String(error).slice(0, 300);
      console.error("Resend", r.status, error);
    }
  }
  return { sent, failed, error };
}

async function confirmPhoto(env, p, times, pets) {
  const text = `Hi ${field(p, "first_name", 80)},\n\nYou're booked for Santa photos at ${times.join(", ")} on Saturday, November 21, 2026.\nPets: ${pets}\n\n` +
    `Photos are taken at River Rye Shoppe, the building beside Carolina Virginia Animal Hospital. They're free, and we'll email you a link to download them when they're ready.\n\n` +
    `Can't make it? Please free your time for another family at ${SITE}/cancel.html (enter this email and your phone number).\n\nSee you there!`;
  await sendEmails(env, [letter(field(p, "email", 120), "Your Santa Paws photo time is booked!", text, env)]);
}

async function confirmVendor(env, p) {
  const text = `Hi ${field(p, "contact", 120)},\n\nThanks for applying to be a vendor at Santa Paws on Saturday, November 21, 2026. We'll review your application for ${field(p, "business", 120)} and follow up by email.\n\n` +
    `The vendor fee is $20, payable by cash or check (made payable to Carolina Virginia Animal Hospital). Setup starts at 9 AM and the event runs 10 AM to 3 PM. Please bring your own tables and displays.\n\n` +
    `If you can no longer come, please withdraw at ${SITE}/cancel.html (enter this email and your phone number) so another vendor can have the spot.`;
  await sendEmails(env, [letter(field(p, "email", 120), "We got your Santa Paws vendor application", text, env)]);
}

async function confirmSponsor(env, p) {
  const level = field(p, "level", 40);
  const price = { "North Pole": "$150", Reindeer: "$75", "Elf Friends": "$50" }[level] || "";
  const text = `Hi ${field(p, "contact", 120)},\n\nThank you for signing up ${field(p, "business", 120)} as a ${level} sponsor (${price}) of Santa Paws on Saturday, November 21, 2026! Your spot is held.\n\n` +
    `You can pay by cash or check, made payable to Carolina Virginia Animal Hospital. We'll be in touch with the details and about your logo for the event shirt and digital sign. Your business will appear on our website once everything is confirmed.\n\nThank you for helping keep Santa Paws free for every family.`;
  await sendEmails(env, [letter(field(p, "email", 120), "Thank you for sponsoring Santa Paws!", text, env)]);
}

const AUDIENCES = { photos: "Photo families", vendors: "Vendors", everyone: "Photo families and vendors", test: "Test to yourself" };

async function announce(env, p) {
  const db = env.DB, audience = String(p.audience || "");
  const subject = field(p, "subject", 150), message = field(p, "message", 10000);
  if (!emailReady(env)) return { ok: false, reason: "email_not_set_up" };
  if (!(audience in AUDIENCES) || !subject || !message) return { ok: false, reason: "bad_request" };
  let to = [];
  if (audience === "test") to = [env.REPLY_TO_EMAIL];
  else {
    const qs = [];
    if (audience !== "vendors") qs.push(db.prepare("SELECT email FROM photos"));
    if (audience !== "photos") qs.push(db.prepare("SELECT email FROM vendors"));
    const seen = new Set();
    for (const res of await db.batch(qs)) for (const { email } of res.results) {
      const e = String(email).trim(), k = e.toLowerCase();
      if (looksLikeEmail(e) && !seen.has(k)) { seen.add(k); to.push(e); }
    }
  }
  if (!to.length) return { ok: false, reason: "no_recipients" };
  const result = await sendEmails(env, to.map(e => letter(e, subject, message, env)));
  if (audience !== "test") {
    await db.prepare("INSERT INTO emails (audience, subject, message, sent, failed) VALUES (?, ?, ?, ?, ?)")
      .bind(AUDIENCES[audience], subject, message, result.sent, result.failed).run();
  }
  return { ok: result.sent > 0, reason: result.sent ? undefined : "send_failed", ...result };
}

async function authorized(request, env) {
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_PASSWORD || !given) return false;
  // Compare hashes so the check takes the same time whatever was typed.
  const hash = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([hash(given), hash(env.ADMIN_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const ADMIN_TABLES = ["photos", "vendors", "messages", "sponsors"];

async function admin(request, env, path) {
  if (!(await authorized(request, env))) return json({ ok: false, reason: "unauthorized" }, 401);
  const db = env.DB;
  if (request.method === "GET" && path === "/admin") {
    const tables = [...ADMIN_TABLES, "emails"];
    const res = await db.batch(tables.map(t => db.prepare(`SELECT * FROM ${t} ORDER BY id DESC`)));
    const out = { ok: true, status: await status(db), emailReady: emailReady(env) };
    tables.forEach((t, i) => (out[t] = res[i].results));
    return json(out);
  }
  if (request.method !== "POST") return json({ ok: false, reason: "not_found" }, 404);
  const p = await request.json().catch(() => ({}));
  if (path === "/admin/delete") {
    if (!ADMIN_TABLES.includes(p.table) || !Number.isInteger(p.id)) return json({ ok: false, reason: "bad_request" }, 400);
    await removeRow(db, p.table, p.id);
    return json({ ok: true });
  }
  if (path === "/admin/sponsor") {
    const business = field(p, "business", 120), level = field(p, "level", 40), show = p.show === false ? 0 : 1;
    if (!business || !(level in SPONSOR_LEVELS)) return json({ ok: false, reason: "bad_request" }, 400);
    if (Number.isInteger(p.id)) {
      await db.prepare("UPDATE sponsors SET business = ?, level = ?, show = ? WHERE id = ?").bind(business, level, show, p.id).run();
    } else {
      await db.prepare("INSERT INTO sponsors (business, level, show, website, logo) VALUES (?, ?, ?, ?, ?)")
        .bind(business, level, show, field(p, "website", 200), logoField(p)).run();
    }
    return json({ ok: true });
  }
  if (path === "/admin/email") return json(await announce(env, p));
  if (path === "/admin/show") {
    if (!["vendors", "sponsors"].includes(p.table) || !Number.isInteger(p.id)) return json({ ok: false, reason: "bad_request" }, 400);
    await db.prepare(`UPDATE ${p.table} SET show = ? WHERE id = ?`).bind(p.show ? 1 : 0, p.id).run();
    return json({ ok: true });
  }
  return json({ ok: false, reason: "not_found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path.startsWith("/admin")) return await admin(request, env, path);
      const lm = path.match(/^\/logo\/(vendor|sponsor)\/(\d+)$/);
      if (lm && request.method === "GET") return await logo(env.DB, lm[1], Number(lm[2]));
      if (path !== "/") return json({ ok: false, reason: "not_found" }, 404);
      const db = env.DB;
      if (request.method === "GET") {
        const code = url.searchParams.get("lookup");
        if (code !== null) {
          const hit = await lookup(db, code);
          return json(hit ? { ok: true, ...hit.info } : { ok: false });
        }
        return json(await status(db));
      }
      if (request.method !== "POST") return json({ ok: false, reason: "not_found" }, 404);
      const p = Object.fromEntries(await request.formData());
      switch (p.form) {
        case "photo": {
          const r = await bookPhoto(db, p);
          if (r.ok && emailReady(env)) { r.emailed = true; ctx.waitUntil(confirmPhoto(env, p, r.times, r.pets).catch(err => console.error(err))); }
          return json(r);
        }
        case "vendor": {
          const r = await applyVendor(db, p);
          if (r.ok && emailReady(env)) { r.emailed = true; ctx.waitUntil(confirmVendor(env, p).catch(err => console.error(err))); }
          return json(r);
        }
        case "sponsor": {
          const r = await applySponsor(db, p);
          if (r.ok && emailReady(env)) { r.emailed = true; ctx.waitUntil(confirmSponsor(env, p).catch(err => console.error(err))); }
          return json(r);
        }
        case "contact": return json(await saveMessage(db, p));
        case "cancel": return json(await cancel(db, field(p, "code", 64)));
        case "find": return json(await find(db, p));
        default: return json({ ok: false, reason: "unknown_form" }, 400);
      }
    } catch (err) {
      console.error(err);
      return json({ ok: false, reason: "error" }, 500);
    }
  },
};
