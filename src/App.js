import React, { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import emailjs from '@emailjs/browser';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';

const IS_UNDER_MAINTENANCE = false; // set to false when you want to reopen
const MAINTENANCE_MESSAGE = "Vibe & Volley is temporarily unavailable as we are undergoing a facelift! Keep an eye on our Instagram handle for updates!";

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
  ],
  afternoon: [
    /*"2:00 PM - 2:30 PM",
    "2:30 PM - 3:00 PM",
    "3:00 PM - 3:30 PM",
    "3:30 PM - 4:00 PM",*/
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

const BANNED_PHONES = [
  "7499122175",
  "8087940490",
  // Add more banned phone numbers here
];

const BANNED_EMAILS = [
  "banned@example.com",
  "spam@example.com",
  // Add more banned emails here
];


const VIBESLOT_ELIGIBLE_SLOTS  = [
        "4:00 PM - 4:30 PM",
        "4:30 PM - 5:00 PM",
        "5:00 PM - 5:30 PM",
        "5:30 PM - 6:00 PM",
  ]

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

  const isVibeslotValid =
    promoCode.trim().toUpperCase() === "VIBESLOT" &&
    selectedSlots.length > 0 &&
    selectedSlots.every((slot) => VIBESLOT_ELIGIBLE_SLOTS.includes(slot));

  const isVibeslotInvalid =
    promoCode.trim().toUpperCase() === "VIBESLOT" &&
    selectedSlots.length > 0 &&
    !isVibeslotValid;


  const navigate = useNavigate();

  const isBanned =
    BANNED_PHONES.includes(phone.trim()) ||
    BANNED_EMAILS.includes(email.trim().toLowerCase());

  const isFormReady =
    name.trim() !== "" && 
    phone.trim().length === 10 && 
    bookingDate !== ""&&
    email.trim() !== "" && // Add email validation
    email.includes("@") &&// Basic email validation
    !isBanned;

  // Fetch booked slots function
  const fetchBookedSlots = async (date, block) => {
    if (!date || !block) return [];
    
    try {
      /*console.log('Fetching slots for:', date, block);*/
      const { data, error } = await supabase
        .from('bookings')
        .select('slots')
        .eq('booking_date', date)
        .eq('time_block', block);

      if (error) throw error;
      /*console.log('Fetched data:', data);*/
      
      const booked = data.flatMap(booking => {
        if (typeof booking.slots === 'string') {
          try {
            return JSON.parse(booking.slots);
          } catch (e) {
            console.error('Failed to parse slots JSON:', booking.slots);
            return [];
          }
        }
        return booking.slots || [];
      });
      
      /*console.log('Processed booked slots:', booked);*/
      return booked;
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      return [];
    }
  };

  // Fetch booked slots when date/time changes
  useEffect(() => {
    if (!bookingDate || !timeBlock) {
      setBookedSlots([]);
      return;
    } 

    const loadSlots = async () => {
      setLoadingSlots(true);
      const booked = await fetchBookedSlots(bookingDate, timeBlock);
      console.log('About to set bookedSlots:', booked);
      setBookedSlots(booked);
      setLoadingSlots(false);
    };

    loadSlots();
  }, [bookingDate, timeBlock]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('booking-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings' 
        },
        async (payload) => {
          console.log('Booking change detected:', payload);
          if (bookingDate && timeBlock) {
            const booked = await fetchBookedSlots(bookingDate, timeBlock);
            setBookedSlots(booked);
          }
        }
      )
      .subscribe((status) => {
      console.log('Realtime subscription status:', status); // ← Added status log
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingDate, timeBlock]);

  const toggleSlot = (slot) => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const isBookButtonDisabled = selectedSlots.length === 0;
  const totalPrice = selectedSlots.length * 250;

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

    if (isBanned) {
      setMessage("❌ This phone number or email is not allowed to make bookings.");
      return;
    }

    // Cutoff rule: block next-day morning bookings after 11pm today
    if (isNextMorningCutoffPassed()) {
      setMessage("❌ Morning bookings for tomorrow are closed after 11:00 pm. Please choose a different time or date.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    // ✅ Fetch latest slots right before submitting
    const latestBooked = await fetchBookedSlots(bookingDate, timeBlock);
    const conflict = selectedSlots.some(slot => latestBooked.includes(slot));

    if (conflict) {
      setBookedSlots(latestBooked); // Update UI to show newly booked slots
      setSelectedSlots([]); // Clear user's selection
      setMessage("❌ One or more slots were just booked by someone else. Please reselect.");
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            name,
            phone,
            email,
            booking_date: bookingDate,
            time_block: timeBlock,
            slots: selectedSlots,
            promo_code: promoCode || null,
            // Store 0 for VIBESLOT since total is calculated on site
            total_price: isVibeslotValid ? 0 : totalPrice,
          }
        ])
        .select();

      if (error) throw error;

      const emailParams = {
        to_email: email,
        to_name: name,
        booking_date: bookingDate,
        time_block: timeBlock,
        selected_slots: selectedSlots.join(', '),
        // Send appropriate price info in email
        total_price: isVibeslotValid
          ? '₹75 per player (calculated on site)'
          : `₹${totalPrice}`,
        phone: phone,
        promo_code: promoCode || 'None',
      };

      await emailjs.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID,
        process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
        emailParams,
        process.env.REACT_APP_EMAILJS_PUBLIC_KEY
      );

      // Different confirmation message based on promo
      setMessage(
        isVibeslotValid
          ? `✅ Booking confirmed! ₹75 per player will be charged on site. Confirmation sent to ${email}.`
          : `✅ Booking confirmed! Confirmation email sent to ${email}. Total: ₹${totalPrice}`
      );

      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setBookingDate("");
      setPromoCode("");
      setTimeBlock("");
      setSelectedSlots([]);

    } catch (error) {
      console.error('Error saving booking:', error);
      setMessage("❌ Booking failed. Please try again.");
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

            <h1 className="main-title">TIMINGS</h1>
            
            <div className="timing-section">
              <div className="day-group">
                <h3 className="day-title">Monday - Friday</h3>
                <div className="time-info">
                  <p className="time-slot-info">7am - 11am</p>
                  <p className="time-slot-info">4pm - 11pm</p>
                </div>
              </div>
              
              <div className="day-group">
                <h3 className="day-title">Saturday and Sunday</h3>
                <div className="time-info">
                  <p className="time-slot-info">7am - 11am</p>
                  <p className="time-slot-info">4pm - 11pm</p>
                </div>
              </div>
            </div>

            <div className="pricing-section">
              <h3 className="pricing-title">Court Rates</h3>
              <div className="price-info">
                <p className="price-item">₹500 per hour including equipment</p>
              </div>
            </div>
            
            <div className="contact-section">
              <p className="contact-info">Contact us for off time bookings: +91 9156156570</p>
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

            {/* Manage Bookings Button */}
            <button
              type="button"
              onClick={() => navigate('/manage')}
              className="manage-bookings-btn"
            >
              Manage Your Booking/s
            </button>

            {/*<h2 className="form-title">Vibe & Volley</h2>*/}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="admin-login-btn"
            >
              Admin Login
            </button>
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
              <input
                className="form-input"
                placeholder="Phone Number"
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
              {<div className="form-group">
                <label className="form-label">Promo Code</label>
                <input
                  className="form-input"
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  disabled={submitting}
                />
              </div>}
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
              <div className={`price-summary ${isVibeslotValid ? 'promo-applied' : ''}`}>
                {isVibeslotValid ? (
                  <p className="promo-per-player">
                    🎉 Promo <strong>VIBESLOT</strong> applied! ₹75 per player will be charged on site.
                  </p>
                ) : (
                  <>
                    Total Price: ₹{totalPrice} for {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
                    {isVibeslotInvalid && (
                      <p className="promo-warning">
                        ⚠️ VIBESLOT is only valid for 4:00 PM – 6:00 PM slots.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {isBanned && (phone.length === 10 || email.includes("@")) && (
              <div className="message error">
                ❌ This phone number or email is not eligible to make bookings. 
                Please contact us at +91 9156156570 for assistance.
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
    const fetchBookings = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('bookings')
          .select('*')
          .order('booking_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (selectedDate) {
          query = query.eq('booking_date', selectedDate);
        }

        if (searchPhone) {
          query = query.ilike('phone', `%${searchPhone}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setBookings(data || []);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [selectedDate, searchPhone]);

  const navigate = useNavigate();

  const handleLogout = () => {
  localStorage.removeItem('authenticated');
  navigate('/login');
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('bookings')
        .select('*')
        .order('booking_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedDate) {
        query = query.eq('booking_date', selectedDate);
      }

      if (searchPhone) {
        query = query.ilike('phone', `%${searchPhone}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteBooking = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        fetchBookings(); // Refresh the list
        alert('Booking deleted successfully!');
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Failed to delete booking');
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
                  <th>Email</th>
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
                    <td>{booking.email}</td>
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
        let query = supabase
          .from('bookings')
          .select('*')
          .order('booking_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (selectedDate) {
          query = query.eq('booking_date', selectedDate);
        }

        if (searchPhone) {
          query = query.ilike('phone', `%${searchPhone}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setBookings(data || []);
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

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple authentication check
    if (email === 'admin@vibevolley' && password === 'vibe123') {
      localStorage.setItem('authenticated', 'true');
      navigate('/admin');
    } else {
      setError('Invalid id or password');
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
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('phone', phone)
        .gte('booking_date', new Date().toISOString().slice(0, 10))
        .order('booking_date', { ascending: true });

      if (error) throw error;

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
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      setMessage('✅ Booking cancelled successfully!');
      // Refresh the bookings list
      setUserBookings(userBookings.filter(b => b.id !== bookingId));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setMessage('❌ Failed to cancel booking. Please try again.');
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
function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('authenticated') === 'true';
  
  if (!isAuthenticated) {
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

        {/* Admin / staff / login always accessible */}
        <Route path="/login" element={<Login />} />
        <Route path="/staff" element={<StaffBookings />} />
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

