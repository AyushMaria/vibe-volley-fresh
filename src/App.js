import React, { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import emailjs from '@emailjs/browser';

const TIME_BLOCKS = ["morning", "afternoon", "evening"];
const TIME_SLOTS = {
  morning: [
    "7:00 AM - 7:30 AM",
    "8:00 AM - 8:30 AM",
    "8:30 AM - 9:00 AM",
    "9:00 AM - 9:30 AM", 
    "9:30 AM - 10:00 AM",
    "10:00 AM - 10:30 AM",
    "10:30 AM - 11:00 AM",
  ],
  afternoon: [
    "2:00 PM - 2:30 PM",
    "2:30 PM - 3:00 PM",
    "3:00 PM - 3:30 PM",
    "3:30 PM - 4:00 PM",
    "4:00 PM - 4:30 PM",
    "4:30 PM - 4:00 PM",
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
  ],
};
export default function App() {
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

  const isFormReady =
    name.trim() !== "" && 
    phone.trim().length === 10 && 
    bookingDate !== ""&&
    email.trim() !== "" && // Add email validation
    email.includes("@"); // Basic email validation

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
          event: 'INSERT', 
          schema: 'public', 
          table: 'bookings' 
        },
        async (payload) => {
          console.log('New booking inserted:', payload);
          if (bookingDate && timeBlock) {
            const booked = await fetchBookedSlots(bookingDate, timeBlock);
            setBookedSlots(booked);
          }
        }
      )
      .subscribe();

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

  const handleBookSlot = async (e) => {
    e.preventDefault();
    if (isBookButtonDisabled || submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      const { data, error } = await supabase
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
            total_price: totalPrice
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
        total_price: totalPrice,
        phone: phone,
        promo_code: promoCode || 'None'
      }

      console.log('Sending email with params:', emailParams); // Debug log

      await emailjs.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID,
        process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
        emailParams,
        process.env.REACT_APP_EMAILJS_PUBLIC_KEY // Replace with your EmailJS public key
      );

      setMessage(`✅ Booking confirmed! Confirmation email sent to ${email}. Total: ₹${totalPrice}`);
      
      // Reset form
      setName("");
      setPhone("");
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
                  <p className="time-slot-info">3pm - 11pm</p>
                </div>
              </div>
              
              <div className="day-group">
                <h3 className="day-title">Saturday and Sunday</h3>
                <div className="time-info">
                  <p className="time-slot-info">7am - 11am</p>
                  <p className="time-slot-info">2pm - 11pm</p>
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
              <p className="contact-info">Call Us: +91 9156156570</p>
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
            {/*<h2 className="form-title">Vibe & Volley</h2>*/}
            
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
              <div className="form-group">
                <label className="form-label">Promo Code</label>
                <input
                  className="form-input"
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  disabled={submitting}
                />
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
              <div className="price-summary">
                Total Price: ₹{totalPrice} for {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
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
