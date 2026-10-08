/**
 * Santa Paws sign-up service.
 *
 * Public API (used by the website):
 *   GET  /                 -> { booked, vendors: {max, taken}, sponsors: {level: {max, taken, names}} }
 *   GET  /?lookup=CODE     -> what a cancel code refers to
 *   POST / form=photo|vendor|contact|cancel -> { ok, reason?, taken?, code?, status? }
 *
 * Admin API (Authorization: Bearer ADMIN_PASSWORD), used by admin.html:
 *   GET  /admin            -> every table
 *   POST /admin/delete     { table, id }
 *   POST /admin/sponsor    { business, level, show }  (with id to update)
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

const newCode = () => crypto.randomUUID().replace(/-/g, "");

async function status(db) {
  const [slots, vendors, sponsors] = await db.batch([
    db.prepare("SELECT time FROM photo_slots"),
    db.prepare("SELECT COUNT(*) AS n FROM vendors"),
    db.prepare("SELECT business, level, show FROM sponsors ORDER BY id"),
  ]);
  const levels = {};
  for (const [level, max] of Object.entries(SPONSOR_LEVELS)) {
    const rows = sponsors.results.filter(s => s.level === level);
    levels[level] = { max, taken: rows.length, names: rows.filter(s => s.show).map(s => s.business) };
  }
  return {
    booked: slots.results.map(r => r.time),
    vendors: { max: VENDOR_MAX, taken: vendors.results[0].n },
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
  return { ok: true, code, times, status: await status(db) };
}

async function applyVendor(db, p) {
  const business = field(p, "business", 120), contact = field(p, "contact", 120), email = field(p, "email", 120);
  if (!business || !contact || !email) return { ok: false, reason: "missing" };
  const code = newCode();
  // The count check and insert are one statement, so two last-minute applications can't both get spot 15.
  const r = await db.prepare(
    `INSERT INTO vendors (business, contact, email, phone, category, website, needs, description, code)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM vendors) < ?`)
    .bind(business, contact, email, field(p, "phone", 40), field(p, "category", 80), field(p, "website", 200),
      field(p, "needs", 500), field(p, "description", 2000), code, VENDOR_MAX)
    .run();
  if (!r.meta.changes) return { ok: false, reason: "full", status: await status(db) };
  return { ok: true, code, status: await status(db) };
}

async function saveMessage(db, p) {
  const name = field(p, "name", 120), email = field(p, "email", 120), message = field(p, "message", 5000);
  if (!name || !email || !message) return { ok: false, reason: "missing" };
  await db.prepare("INSERT INTO messages (name, email, phone, topic, message) VALUES (?, ?, ?, ?, ?)")
    .bind(name, email, field(p, "phone", 40), field(p, "topic", 80), message).run();
  return { ok: true };
}

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
    const res = await db.batch(ADMIN_TABLES.map(t => db.prepare(`SELECT * FROM ${t} ORDER BY id DESC`)));
    const out = { ok: true, status: await status(db) };
    ADMIN_TABLES.forEach((t, i) => (out[t] = res[i].results));
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
      await db.prepare("INSERT INTO sponsors (business, level, show) VALUES (?, ?, ?)").bind(business, level, show).run();
    }
    return json({ ok: true });
  }
  return json({ ok: false, reason: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path.startsWith("/admin")) return await admin(request, env, path);
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
        case "photo": return json(await bookPhoto(db, p));
        case "vendor": return json(await applyVendor(db, p));
        case "contact": return json(await saveMessage(db, p));
        case "cancel": return json(await cancel(db, field(p, "code", 64)));
        default: return json({ ok: false, reason: "unknown_form" }, 400);
      }
    } catch (err) {
      console.error(err);
      return json({ ok: false, reason: "error" }, 500);
    }
  },
};
