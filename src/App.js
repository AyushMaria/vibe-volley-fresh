import React, { useState, useEffect } from "react";
import "./App.css";
// The browser no longer talks to Supabase. Every read and write goes through
// /api/* handlers holding the secret key, so no database credential ships here.
// import emailjs from '@emailjs/browser';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';

const IS_UNDER_MAINTENANCE = false; // set to false when you want to reopen
const MAINTENANCE_MESSAGE = "Vibe & Volley is temporarily unavailable as we are undergoing a facelift! Keep an eye on our Instagram handle for updates!";

/**
 * Thin wrapper over the /api handlers. Sends cookies so staff/admin sessions
 * work, and surfaces the server's error text rather than a generic failure.
 */
async function api(path, { method = "GET", body, params } = {}) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/${path}${qs}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const TIME_BLOCKS = ["morning", "afternoon", "evening"];
const TIME_SLOTS = {
  morning: [
    "7:00 AM - 7:30 AM",
    "7:30 AM - 8:00 AM",
    "8:00 AM - 8:30 AM",
    "8:30 AM - 9:00 AM",
    "9:00 AM - 9:30 AM", 
    "9:30 AM - 10:00 AM",
    "10:00 AM - 10:30 AM",
    "10:30 AM - 11:00 AM",
    "11:00 AM - 11:30 AM",
    "11:30 AM - 12:00 PM",
  ],
  afternoon: [
    "12:00 PM - 12:30 PM",
    "12:30 PM - 1:00 PM",
    "1:00 PM - 1:30 PM",
    "1:30 PM - 2:00 PM",
    "2:00 PM - 2:30 PM",
    "2:30 PM - 3:00 PM",
    "3:00 PM - 3:30 PM",
    "3:30 PM - 4:00 PM",
    "4:00 PM - 4:30 PM",
    "4:30 PM - 5:00 PM",
  ],
  evening: [
    "5:00 PM - 5:30 PM",
    "5:30 PM - 6:00 PM",
    "6:00 PM - 6:30 PM",
    "6:30 PM - 7:00 PM",
    "7:00 PM - 7:30 PM",
    "7:30 PM - 8:00 PM",
    "8:00 PM - 8:30 PM", 
    "8:30 PM - 9:00 PM",
    "9:00 PM - 9:30 PM",
    "9:30 PM - 10:00 PM",
    "10:00 PM - 10:30 PM",
    "10:30 PM - 11:00 PM",
    "11:00 PM - 11:30 PM",
    "11:30 PM - 12:00 AM",
  ],
};

// Off-peak = 9:00 AM – 5:00 PM. Rate: ₹150 per 30-min slot (₹300/hr).
// Peak   = everything else.        Rate: ₹250 per 30-min slot (₹500/hr).
const OFF_PEAK_SLOTS = new Set([
  "9:00 AM - 9:30 AM",
  "9:30 AM - 10:00 AM",
  "10:00 AM - 10:30 AM",
  "10:30 AM - 11:00 AM",
  "11:00 AM - 11:30 AM",
  "11:30 AM - 12:00 PM",
  "12:00 PM - 12:30 PM",
  "12:30 PM - 1:00 PM",
  "1:00 PM - 1:30 PM",
  "1:30 PM - 2:00 PM",
  "2:00 PM - 2:30 PM",
  "2:30 PM - 3:00 PM",
  "3:00 PM - 3:30 PM",
  "3:30 PM - 4:00 PM",
  "4:00 PM - 4:30 PM",
  "4:30 PM - 5:00 PM",
]);

const PEAK_RATE = 250;     // ₹ per 30-min slot
const OFF_PEAK_RATE = 150; // ₹ per 30-min slot

// The ban list now lives in api/_lib/slots.js and is enforced by /api/book.
// Keeping it here published who was banned and let anyone edit it out of their
// own copy of the bundle.



function MaintenancePage() {
  return (
    <div className="App">
      <div className="maintenance-container">
        <div className="maintenance-card">
          <h1>🔧 Court Under Maintenance</h1>
          <p>{MAINTENANCE_MESSAGE}</p>

          <div className="maintenance-social">
            <span>Stay updated here:</span>
            <a
              href="https://instagram.com/vibeandvolley"
              target="_blank"
              rel="noopener noreferrer"
              className="instagram-link"
            >
              {/* Simple Instagram icon using text */}
              <span className="instagram-icon">📸</span>
              <span>@vibeandvolley</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


function BookingForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [timeBlock, setTimeBlock] = useState("");
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoStatus, setPromoStatus] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState("");
  
  const navigate = useNavigate();

  const fetchAndApplyPromo = async () => {
    const raw = promoCode.trim().toUpperCase();
    if (!raw) {
      setAppliedPromo(null);
      setPromoStatus("");
      return;
    }
  
    if (selectedSlots.length === 0) {
      setPromoStatus("⚠️ Select at least one slot before applying a promo code.");
      return;
    }
  
    setPromoLoading(true);
    setPromoStatus("");
    setAppliedPromo(null);
  
    try {
      // The server decides whether the code is valid and what it is worth.
      // This result is for display only -- /api/book re-validates on its own.
      const result = await api("promo", {
        method: "POST",
        body: { code: raw, slots: selectedSlots, phone: phone.trim() },
      });

      if (!result.valid) {
        setPromoStatus(`❌ ${result.reason}`);
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({ code: result.code, total: result.total, discount: result.discount });
      setPromoStatus(`✅ Promo code ${result.code} applied!`);
    } catch (err) {
      console.error("Promo validation error:", err);
      setPromoStatus("❌ Failed to validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };
  
  // Display only. The figure that is actually charged comes back from /api/book.
  const calculateFinalPrice = () =>
    appliedPromo && typeof appliedPromo.total === "number"
      ? appliedPromo.total
      : totalPrice;
  
  const getPriceDisplay = () => {
    const final = calculateFinalPrice();
    if (!appliedPromo) return `₹${totalPrice}`;
    if (final === 0) return "₹0 (Free with promo)";
    return `₹${final} (was ₹${totalPrice})`;
  };
  
  
  const isFormReady =
    name.trim() !== "" &&
    phone.trim().length === 10 &&
    bookingDate !== "";

  // Fetch booked slots function
  const fetchBookedSlots = async (date) => {
    if (!date) return [];
    try {
      // Asks for the whole day rather than one time block. The old query
      // filtered on time_block, so a booking straddling two blocks was
      // invisible to the other one and could be double-booked.
      const result = await api('availability', { params: { date } });
      return result.booked || [];
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      return [];
    }
  };

  // Load availability, then keep it fresh by polling.
  //
  // The realtime subscription this replaces required the browser to hold a
  // Supabase key and an open channel on the bookings table — which is what put
  // the table in the realtime publication and exposed every booking as a live
  // feed. Polling the availability endpoint is plenty for a booking form and
  // returns nothing but slot strings.
  useEffect(() => {
    if (!bookingDate || !timeBlock) {
      setBookedSlots([]);
      return;
    }

    let cancelled = false;

    const loadSlots = async (showSpinner) => {
      if (showSpinner) setLoadingSlots(true);
      const booked = await fetchBookedSlots(bookingDate);
      if (cancelled) return;
      setBookedSlots(booked);
      if (showSpinner) setLoadingSlots(false);
    };

    loadSlots(true);
    const poll = setInterval(() => loadSlots(false), 20000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDate, timeBlock]);

  // Changing the selection invalidates the server-computed discount, so the
  // code has to be applied again against the new slots.
  useEffect(() => {
    if (!appliedPromo) return;
    setAppliedPromo(null);
    setPromoStatus("⚠️ Selection changed — please apply your promo code again.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlots]);

  const toggleSlot = (slot) => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const isBookButtonDisabled = selectedSlots.length === 0 || !paymentMode;
  // Calculate price per slot — off-peak slots (9 AM – 5 PM) cost ₹150,
  // peak slots cost ₹250.
  const peakCount = selectedSlots.filter(s => !OFF_PEAK_SLOTS.has(s)).length;
  const offPeakCount = selectedSlots.length - peakCount;
  const totalPrice = peakCount * PEAK_RATE + offPeakCount * OFF_PEAK_RATE;

  // Returns true if booking is NOT allowed due to 11pm cutoff for next-morning bookings
  const isNextMorningCutoffPassed = () => {
    if (!bookingDate || timeBlock !== "morning") return false;

    const now = new Date();

    // Build "tomorrow" date string
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Only care when user tries to book *tomorrow morning*
    if (bookingDate !== tomorrowStr) return false;

    // Build cutoff datetime: today at 23:00
    const cutoff = new Date();
    cutoff.setHours(23, 0, 0, 0);

    return now > cutoff;
  };

  const handleBookSlot = async (e) => {
    e.preventDefault();
    if (isBookButtonDisabled || submitting) return;

    // Cutoff rule: block next-day morning bookings after 11pm today
    if (isNextMorningCutoffPassed()) {
      setMessage("❌ Morning bookings for tomorrow are closed after 11:00 pm. Please choose a different time or date.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    // ✅ Fetch latest slots right before submitting
    const latestBooked = await fetchBookedSlots(bookingDate);
    const conflict = selectedSlots.some(slot => latestBooked.includes(slot));

    if (conflict) {
      setBookedSlots(latestBooked); // Update UI to show newly booked slots
      setSelectedSlots([]); // Clear user's selection
      setMessage("❌ One or more slots were just booked by someone else. Please reselect.");
      setSubmitting(false);
      return;
    }

    if (promoCode.trim() && !appliedPromo) {
      setMessage("❌ Please apply your promo code using the Apply button before confirming.");
      setSubmitting(false);
      return;
    }

    try {
      // The server prices the booking and re-checks the promo, the ban list,
      // the 11pm cutoff and slot conflicts. Nothing about money is taken from
      // this form — a crafted request used to be able to book at any price.
      const result = await api('book', {
        method: 'POST',
        body: {
          name,
          phone: phone.trim(),
          email,
          bookingDate,
          slots: selectedSlots,
          promoCode: appliedPromo?.code || promoCode.trim() || null,
          paymentMode,
        },
      });

      const confirmedTotal = `₹${result.booking.total_price}`;

      
      // EmailJS confirmation disabled — WhatsApp confirmation used instead.
      // const emailParams = {
      //   to_email: email,
      //   to_name: name,
      //   booking_date: bookingDate,
      //   time_block: timeBlock,
      //   selected_slots: selectedSlots.join(', '),
      //   total_price: getPriceDisplay(),
      //   phone: phone,
      //   promo_code: promoCode || 'None',
      //   payment_mode: paymentMode,
      // };
      //
      // await emailjs.send(
      //   process.env.REACT_APP_EMAILJS_SERVICE_ID,
      //   process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
      //   emailParams,
      //   process.env.REACT_APP_EMAILJS_PUBLIC_KEY
      // );

      // 🆕 Send WhatsApp confirmation via Vercel serverless function.
      // Failures are swallowed so they never break the booking.
      try {
        await fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone: `+91${phone.trim()}`,
            bookingDate,
            timeBlock,
            slots: selectedSlots.join(', '),
            totalPrice: confirmedTotal,
            promoCode: promoCode || 'None',
          }),
        });
      } catch (waErr) {
        console.warn('WhatsApp notification failed (non-blocking):', waErr);
      }

      // Different confirmation message based on promo
      setMessage(`✅ Booking confirmed! WhatsApp confirmation sent. Total: ${confirmedTotal}`);

      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setBookingDate("");
      setPromoCode("");
      setAppliedPromo(null);
      setPromoStatus("");
      setTimeBlock("");
      setSelectedSlots([]);
      setPaymentMode("");

    } catch (error) {
      console.error('Error saving booking:', error);
      // Surface the server's reason (slot taken, cutoff passed, banned, promo
      // rejected) instead of a blanket failure.
      setMessage(`❌ ${error.message || 'Booking failed. Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };



  const isSlotBooked = (slot) => {
    /*console.log('=== SLOT COMPARISON DEBUG ===');
    console.log('Checking slot from TIME_SLOTS:', `"${slot}"`);
    console.log('Against bookedSlots from database:');*/
    
    //bookedSlots.forEach((bookedSlot, index) => {
      //console.log(`  [${index}]: "${bookedSlot}"`);
      //console.log(`  Match with "${slot}"?`, bookedSlot === slot);
    //});
  
    const result = bookedSlots.includes(slot);
    //console.log('Final result:', result);
    //console.log('==============================');
  
    return result;
  };

  return (
    <div className="App">
      <div className="booking-container">
        {/* Left Side - Branding */}
        <div className="left-panel">
          <div className="brand-content">
            <div className="logo-section">
              <img 
                src="/logo.jpg" 
                alt="Vibe & Volley Logo" 
                className="left-logo-image"
              />
              <p className="left-form-subtitle">by Tiny Tots Kindergarten</p>
            </div>

            {/* <h1 className="main-title">TIMINGS</h1> */}
            
            <div className="timing-section">
              <div className="day-group">
                <h3 className="day-title">Monday - Sunday</h3>
                <div className="time-info">
                  <p className="time-slot-info">7am - 12am</p>
                </div>
              </div>
              
              <div className="day-group">
                <h3 className="day-title">Premium Paddles Available @ ₹50 per hr</h3>
                <div className="time-info">
                  <p className="time-slot-info">Agassi</p>
                  <p className="time-slot-info">Boomstik</p>
                  <p className="time-slot-info">J2NF</p>
                  <p className="time-slot-info">Perseus IV</p>
                </div>
              </div>
            </div>

            <div className="pricing-section">
              <h3 className="pricing-title">Court Rates</h3>
              <div className="price-info">
                <p className="price-item">Peak: ₹500 per hour including equipment</p>
                <p className="price-item">Off-Peak (9am - 5pm): ₹300 per hour including equipment</p>
              </div>
            </div>
            
            <div className="contact-section">
              <p className="contact-info">Admin: +91 9156156570</p>
              <p className="contact-info">On Site Staff: +91 9096876337</p>    
            </div>
          </div>
        </div>

        {/* Right Side - Booking Form */}
        <div className="right-panel">
          <div className="form-header">
            <p className="form-subtitle">powered by</p>
            <img 
              src="/FE_logo.png" 
              alt="Vibe & Volley Logo" 
              className="logo-image"
            />

          </div>

          <form onSubmit={handleBookSlot} className="booking-form">
            <div className="form-group">
              <input
                className="form-input"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="form-group">
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+91</span>
                <input
                  className="form-input"
                  placeholder="9876543210"
                  value={phone}
                  maxLength={10}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 10) val = val.slice(0, 10);
                    setPhone(val);
                  }}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {/* Email input disabled — WhatsApp confirmation used instead.
            <div className="form-group">
              <input
                className="form-input"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            */}

            <div className="form-group">
              <label className="form-label">Payment Mode (Paid after playing)</label>
              <select
                className="form-input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="" disabled>Choose one</option>
                <option value="Cash">Cash</option>
                <option value="Upi">UPI</option>
              </select>
              {!paymentMode && (
                <p style={{ fontSize: "0.85rem", marginTop: "4px", color: "orange" }}>
                  Please choose a payment mode.
                </p>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-input date-input"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  disabled={submitting}
                  required
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Promo Code</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    className="form-input"
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setAppliedPromo(null);
                      setPromoStatus("");
                    }}
                    disabled={submitting || promoLoading}
                  />
                  <button
                    type="button"
                    onClick={fetchAndApplyPromo}
                    disabled={!promoCode.trim() || submitting || promoLoading}
                    className="time-block-btn"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {promoLoading ? "..." : "Apply"}
                  </button>
                </div>
                {promoStatus && (
                  <p style={{ fontSize: "0.85rem", marginTop: "4px", color: promoStatus.startsWith("✅") ? "green" : "orange" }}>
                    {promoStatus}
                  </p>
                )}
              </div>                 
            </div>

            <div className="form-group">
              <label className="form-label">Time of Day</label>
              <div className="time-blocks">
                {TIME_BLOCKS.map((block) => {
                  const disabled = !isFormReady || submitting;
                  return (
                    <button
                      key={block}
                      type="button"
                      onClick={() => {
                        if (!disabled) {
                          setTimeBlock(block);
                          setSelectedSlots([]);
                        }
                      }}
                      className={`time-block-btn ${timeBlock === block ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                      disabled={disabled}
                    >
                      {block.charAt(0).toUpperCase() + block.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {timeBlock && TIME_SLOTS[timeBlock] && (
              <div className="form-group">
                <div className="slot-header">
                  <label className="form-label">
                    <span role="img" aria-label="time slots">⏳</span> Select Time Slots
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoadingSlots(true);
                      const booked = await fetchBookedSlots(bookingDate, timeBlock);
                      setBookedSlots(booked);
                      setLoadingSlots(false);
                    }}
                    className="refresh-btn"
                  >
                    🔄 Refresh
                  </button>
                </div>
                
                {loadingSlots ? (
                  <p className="loading-text">Loading available slots...</p>
                ) : (
                  <div className="time-slots">
                    {TIME_SLOTS[timeBlock].map((slot) => {
                      const booked = isSlotBooked(slot);
                      const selected = selectedSlots.includes(slot);
                      
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={booked || submitting}
                          onClick={() => !booked && toggleSlot(slot)}
                          className={`time-slot ${booked ? 'booked' : ''} ${selected ? 'selected' : ''}`}
                          title={booked ? "Already booked" : ""}
                        >
                          {slot} {booked && "❌"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            
            {selectedSlots.length > 0 && (
              <div className={`price-summary ${appliedPromo ? 'promo-applied' : ''}`}>
                {appliedPromo ? (
                  <p className="promo-per-player">
                    🎉 Promo <strong>{appliedPromo.code}</strong> applied! {getPriceDisplay()} for {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
                  </p>
                ) : (
                  <>
                    <p>Total Price: ₹{totalPrice} for {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}</p>
                    {peakCount > 0 && (
                      <p style={{ fontSize: "0.85rem", color: "#666" }}>
                        Peak: {peakCount} × ₹{PEAK_RATE}
                      </p>
                    )}
                    {offPeakCount > 0 && (
                      <p style={{ fontSize: "0.85rem", color: "#666" }}>
                        Off-Peak: {offPeakCount} × ₹{OFF_PEAK_RATE}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {message && (
              <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isBookButtonDisabled || submitting}
              className={`submit-btn ${(isBookButtonDisabled || submitting) ? 'disabled' : ''}`}
            >
            
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </form>

          {/* 🆕 Moved below Confirm Booking */}
          <button
            type="button"
            onClick={() => navigate('/manage')}
            className="manage-bookings-btn"
          >
            Manage Your Booking/s
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="admin-login-btn"
          >
            Admin Login
          </button>
        </div>
      </div>
    </div>
  );
}

// New Admin Bookings Component
function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, searchPhone]);

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api('session', { method: 'DELETE' });
    } catch (e) {
      /* clearing the cookie is best-effort */
    }
    navigate('/login');
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (searchPhone) params.phone = searchPhone;
      const result = await api('admin', { params });
      setBookings(result.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
      // The session cookie is the gate now, so an expired one means re-login.
      if (error.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const deleteBooking = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await api('admin', { method: 'DELETE', params: { id } });
        fetchBookings(); // Refresh the list
        alert('Booking deleted successfully!');
      } catch (error) {
        console.error('Error deleting booking:', error);
        if (error.status === 401) { navigate('/login'); return; }
        alert(error.message || 'Failed to delete booking');
      }
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>📊 Vibe & Volley - Bookings Dashboard</h1>
        <div>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
          <Link to="/" className="back-to-form">← Back to Booking Form</Link>
        </div>
      </div>
      
      <div className="admin-controls">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          placeholder="Filter by date"
          className="admin-input"
        />
        <input
          type="text"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          placeholder="Search by phone number"
          className="admin-input"
        />
        <button 
          onClick={() => {
            setSelectedDate("");
            setSearchPhone("");
          }}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <p>Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="no-bookings">
          <p>No bookings found for the selected criteria.</p>
        </div>
      ) : (
        <div className="bookings-table-container">
          <div className="bookings-summary">
            <p><strong>Total Bookings:</strong> {bookings.length}</p>
            <p><strong>Total Revenue:</strong> ₹{bookings.reduce((sum, booking) => sum + (booking.total_price || 0), 0)}</p>
          </div>
          
          <div className="table-responsive">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Payment Mode</th>
                  <th>Time Block</th>
                  <th>Slots</th>
                  <th>Total</th>
                  <th>Promo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.booking_date}</td>
                    <td>{booking.name}</td>
                    <td>{booking.phone}</td>
                    <td>{booking.payment_mode || 'None'}</td>
                    <td className="time-block-cell">{booking.time_block}</td>
                    <td className="slots-cell">
                      {Array.isArray(booking.slots) 
                        ? booking.slots.join(', ') 
                        : booking.slots}
                    </td>
                    <td className="price-cell">₹{booking.total_price}</td>
                    <td>{booking.promo_code || 'None'}</td>
                    <td>
                      <button 
                        onClick={() => deleteBooking(booking.id)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// New Staff Bookings Component
function StaffBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        // Scoped to a single day and gated on a staff session. This page used
        // to be unauthenticated and returned every booking ever made.
        const result = await api('staff', {
          params: selectedDate ? { date: selectedDate } : {},
        });
        const rows = result.bookings || [];
        const needle = searchPhone.trim();
        setBookings(needle ? rows.filter((b) => String(b.phone || '').includes(needle)) : rows);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
  }, [selectedDate, searchPhone]);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>📊 Vibe & Volley - Bookings Dashboard</h1>
        <Link to="/" className="back-to-form">← Back to Booking Form</Link>
      </div>
      
      <div className="admin-controls">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          placeholder="Filter by date"
          className="admin-input"
        />
        <input
          type="text"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          placeholder="Search by phone number"
          className="admin-input"
        />
        <button 
          onClick={() => {
            setSelectedDate("");
            setSearchPhone("");
          }}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <p>Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="no-bookings">
          <p>No bookings found for the selected criteria.</p>
        </div>
      ) : (
        <div className="bookings-table-container">
                  
          <div className="table-responsive">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Slots</th>
                  <th>Name</th>
                  <th>Phone</th>
                  {/*<th>Email</th>*/}
                  {/*<th>Time Block</th>*/}
                  <th>Total</th>
                  {/*<th>Promo</th>*/}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.booking_date}</td>
                    <td className="slots-cell">
                      {Array.isArray(booking.slots) 
                        ? booking.slots.join(', ') 
                        : booking.slots}
                    </td>
                    <td>{booking.name}</td>
                    <td>{booking.phone}</td>
                    {/*<td>{booking.email}</td>*/}
                    {/*<td className="time-block-cell">{booking.time_block}</td>*/}
                    <td className="price-cell">₹{booking.total_price}</td>
                    {/*<td>{booking.promo_code || 'None'}</td>*/}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Login Component
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);

  // The passcode is checked on the server and exchanged for an httpOnly
  // cookie. It used to be compared against a literal in this file, which
  // shipped to every visitor, and "success" was a localStorage flag anyone
  // could set from the console.
  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api('session', {
        method: 'POST',
        body: { passcode: password },
      });
      navigate(result.role === 'admin' ? '/admin' : '/staff');
    } catch (err) {
      setError(err.message || 'Incorrect passcode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Admin Login</h2>
        <p>Access the Vibe & Volley Admin Dashboard</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-btn">
            Login to Admin Dashboard
          </button>
        </form>
        
        <div className="login-footer">
          <Link to="/" className="back-link">← Back to Booking Form</Link>
        </div>
      </div>
    </div>
  );
}


// Booking Management Component
function ManageBookings() {
  const [phone, setPhone] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const searchBookings = async (e) => {
    e.preventDefault();
    if (phone.trim().length !== 10) {
      setMessage('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      
      const result = await api('my-bookings', {
        method: 'POST',
        body: { phone: phone.trim() },
      });
      const data = result.bookings || [];

      if (data && data.length > 0) {
        setUserBookings(data);
        setMessage('');
      } else {
        setUserBookings([]);
        setMessage('No upcoming bookings found for this phone number.');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setMessage('Error fetching bookings. Please try again.');
      setUserBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      // The server checks the booking actually belongs to this phone number,
      // so an id on its own is not enough to cancel someone else's slot.
      await api('my-bookings', {
        method: 'POST',
        body: { phone: phone.trim(), cancelId: bookingId },
      });

      setMessage('✅ Booking cancelled successfully!');
      // Refresh the bookings list
      setUserBookings(userBookings.filter(b => b.id !== bookingId));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setMessage(`❌ ${error.message || 'Failed to cancel booking. Please try again.'}`);
    }
  };

  return (
    <div className="App">
      <div className="manage-bookings-container">
        <div className="manage-header">
          <h1>Manage Your Bookings</h1>
          <p>Enter your phone number to view and manage your upcoming bookings</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="back-btn"
          >
            ← Back to Booking Form
          </button>
        </div>

        <div className="search-section">
          <form onSubmit={searchBookings} className="search-form">
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              maxLength={10}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                setPhone(val);
              }}
              className="search-input"
              required
            />
            <button 
              type="submit" 
              disabled={loading || phone.length !== 10}
              className="search-btn"
            >
              {loading ? 'Searching...' : 'Search Bookings'}
            </button>
          </form>

          {message && (
            <div className={`search-message ${message.includes('❌') ? 'error' : userBookings.length === 0 ? 'warning' : 'success'}`}>
              {message}
            </div>
          )}
        </div>

        {userBookings.length > 0 && (
          <div className="bookings-list">
            <h2>Your Upcoming Bookings ({userBookings.length})</h2>
            {userBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-details">
                  <div className="booking-row">
                    <span className="label">Date:</span>
                    <span className="value">{new Date(booking.booking_date).toLocaleDateString()}</span>
                  </div>
                  <div className="booking-row">
                    <span className="label">Name:</span>
                    <span className="value">{booking.name}</span>
                  </div>
                  <div className="booking-row">
                    <span className="label">Email:</span>
                    <span className="value">{booking.email}</span>
                  </div>
                  <div className="booking-row">
                    <span className="label">Time Block:</span>
                    <span className="value time-block">{booking.time_block}</span>
                  </div>
                  <div className="booking-row">
                    <span className="label">Time Slots:</span>
                    <span className="value slots">
                      {Array.isArray(booking.slots) 
                        ? booking.slots.join(', ') 
                        : booking.slots}
                    </span>
                  </div>
                  <div className="booking-row">
                    <span className="label">Total Price:</span>
                    <span className="value price">₹{booking.total_price}</span>
                  </div>
                  {booking.promo_code && (
                    <div className="booking-row">
                      <span className="label">Promo Code:</span>
                      <span className="value">{booking.promo_code}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => cancelBooking(booking.id)}
                  className="cancel-booking-btn"
                >
                  Cancel Booking
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// Protected Route Component
function ProtectedRoute({ children, allow = ['admin'] }) {
  const [state, setState] = useState('checking');

  // Asks the server who this session belongs to. The previous check read a
  // localStorage flag, which the visitor controls.
  useEffect(() => {
    let cancelled = false;
    api('session')
      .then((r) => {
        if (!cancelled) setState(r.role && allow.includes(r.role) ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'checking') {
    return <div className="admin-container"><p>Checking access…</p></div>;
  }
  if (state === 'denied') {
    return <Navigate to="/login" replace />;
  }
  return children;
}


// Main App Component with Login Protection
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes that should show maintenance when flag is true */}
        <Route
          path="/"
          element={
            IS_UNDER_MAINTENANCE ? <MaintenancePage /> : <BookingForm />
          }
        />
        <Route
          path="/manage"
          element={
            IS_UNDER_MAINTENANCE ? <MaintenancePage /> : <ManageBookings />
          }
        />

        {/* Login is public; /admin and /staff require a server session */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/staff"
          element={
            <ProtectedRoute allow={['staff', 'admin']}>
              <StaffBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminBookings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

