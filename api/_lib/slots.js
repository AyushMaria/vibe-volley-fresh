// Single source of truth for slots, pricing and booking rules.
// The browser copy of this logic was advisory; this one is authoritative.
const TIME_SLOTS = {
  morning: [
    '7:00 AM - 7:30 AM', '7:30 AM - 8:00 AM', '8:00 AM - 8:30 AM',
    '8:30 AM - 9:00 AM', '9:00 AM - 9:30 AM', '9:30 AM - 10:00 AM',
    '10:00 AM - 10:30 AM', '10:30 AM - 11:00 AM', '11:00 AM - 11:30 AM',
    '11:30 AM - 12:00 PM',
  ],
  afternoon: [
    '12:00 PM - 12:30 PM', '12:30 PM - 1:00 PM', '1:00 PM - 1:30 PM',
    '1:30 PM - 2:00 PM', '2:00 PM - 2:30 PM', '2:30 PM - 3:00 PM',
    '3:00 PM - 3:30 PM', '3:30 PM - 4:00 PM', '4:00 PM - 4:30 PM',
    '4:30 PM - 5:00 PM',
  ],
  evening: [
    '5:00 PM - 5:30 PM', '5:30 PM - 6:00 PM', '6:00 PM - 6:30 PM',
    '6:30 PM - 7:00 PM', '7:00 PM - 7:30 PM', '7:30 PM - 8:00 PM',
    '8:00 PM - 8:30 PM', '8:30 PM - 9:00 PM', '9:00 PM - 9:30 PM',
    '9:30 PM - 10:00 PM', '10:00 PM - 10:30 PM', '10:30 PM - 11:00 PM',
    '11:00 PM - 11:30 PM', '11:30 PM - 12:00 AM',
  ],
};

const ALL_SLOTS = [...TIME_SLOTS.morning, ...TIME_SLOTS.afternoon, ...TIME_SLOTS.evening];
const SLOT_INDEX = new Map(ALL_SLOTS.map((s, i) => [s, i]));

// Off-peak = 9:00 AM - 5:00 PM at Rs 150/slot; everything else Rs 250.
// Matches get_slot_price() in Ace's tools.py -- keep the two in step.
const OFF_PEAK_SLOTS = new Set([
  '9:00 AM - 9:30 AM', '9:30 AM - 10:00 AM', '10:00 AM - 10:30 AM',
  '10:30 AM - 11:00 AM', '11:00 AM - 11:30 AM', '11:30 AM - 12:00 PM',
  '12:00 PM - 12:30 PM', '12:30 PM - 1:00 PM', '1:00 PM - 1:30 PM',
  '1:30 PM - 2:00 PM', '2:00 PM - 2:30 PM', '2:30 PM - 3:00 PM',
  '3:00 PM - 3:30 PM', '3:30 PM - 4:00 PM', '4:00 PM - 4:30 PM',
  '4:30 PM - 5:00 PM',
]);

const PEAK_RATE = 250;
const OFF_PEAK_RATE = 150;

// Enforced server-side now. The browser list was advisory only -- anyone could
// edit it out of their own bundle.
const BANNED_PHONES = ['7499122175', '8087940490'];
const BANNED_EMAILS = ['banned@example.com', 'spam@example.com'];

function priceFor(slots) {
  return slots.reduce(
    (sum, s) => sum + (OFF_PEAK_SLOTS.has(s) ? OFF_PEAK_RATE : PEAK_RATE),
    0
  );
}

/** Slots may arrive as a JSON string or an array depending on who wrote the row. */
function parseSlots(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function areValidSlots(slots) {
  return (
    Array.isArray(slots) &&
    slots.length > 0 &&
    slots.every((s) => SLOT_INDEX.has(s)) &&
    new Set(slots).size === slots.length
  );
}

function blockFor(slot) {
  if (TIME_SLOTS.morning.includes(slot)) return 'morning';
  if (TIME_SLOTS.afternoon.includes(slot)) return 'afternoon';
  return 'evening';
}

function sortSlots(slots) {
  return [...slots].sort((a, b) => SLOT_INDEX.get(a) - SLOT_INDEX.get(b));
}

/** Current date/time in IST, regardless of where the server runs. */
function nowIST() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

function todayIST() {
  return nowIST().toISOString().slice(0, 10);
}

/**
 * Morning bookings for tomorrow close at 23:00 IST today. Previously computed
 * from the browser clock, so a wrong or foreign timezone sidestepped it.
 */
function isNextMorningCutoffPassed(bookingDate, slots) {
  if (!slots.some((s) => TIME_SLOTS.morning.includes(s))) return false;
  const now = nowIST();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (bookingDate !== tomorrow.toISOString().slice(0, 10)) return false;
  return now.getHours() >= 23;
}

/** Minutes since midnight for a slot's start. Slots are a fixed 30-min grid
 *  from 7:00 AM, so the index gives this without parsing the label. */
function slotStartMinutes(slot) {
  const i = SLOT_INDEX.get(slot);
  return i === undefined ? null : 7 * 60 + i * 30;
}

/** True if the slot has already started today in IST. Mirrors Ace's
 *  slot_has_started(), so the two systems agree on what is still bookable. */
function slotHasStarted(bookingDate, slot) {
  const now = nowIST();
  if (bookingDate !== now.toISOString().slice(0, 10)) return false;
  const start = slotStartMinutes(slot);
  if (start === null) return false;
  return start <= now.getHours() * 60 + now.getMinutes();
}

function isBanned(phone, email) {
  const p = String(phone || '').trim();
  const e = String(email || '').trim().toLowerCase();
  return BANNED_PHONES.includes(p) || (e !== '' && BANNED_EMAILS.includes(e));
}

module.exports = {
  TIME_SLOTS, ALL_SLOTS, OFF_PEAK_SLOTS, PEAK_RATE, OFF_PEAK_RATE,
  priceFor, parseSlots, areValidSlots, blockFor, sortSlots,
  nowIST, todayIST, isNextMorningCutoffPassed, isBanned,
  slotStartMinutes, slotHasStarted,
};
