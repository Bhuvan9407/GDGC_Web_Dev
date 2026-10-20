import React, { useState, useEffect } from 'react';
import StatusChip from '../components/StatusChip';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { api } from '../api';

// Date helpers for Asia/Kolkata timezone
function getKolkataDateString(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getDaysRemaining(targetDateStr) {
  const todayStr = getKolkataDateString(0);
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [bY, bM, bD] = targetDateStr.split('-').map(Number);
  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const targetUtc = Date.UTC(bY, bM - 1, bD);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export default function CustomerDashboard({ user, initialTab = 'orders' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelOrderLoading, setCancelOrderLoading] = useState(false);

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [bookedDates, setBookedDates] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // New Booking Form State
  const minBookingDate = getKolkataDateString(7);
  const maxBookingDate = getKolkataDateString(90);
  const [bookingDate, setBookingDate] = useState(minBookingDate);
  const [wallArea, setWallArea] = useState(50);
  const [serviceAddress, setServiceAddress] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelBookingLoading, setCancelBookingLoading] = useState(false);

  // Pottery Requests State
  const [potteryRequests, setPotteryRequests] = useState([]);
  const [potteryCatalogue, setPotteryCatalogue] = useState({ items: [], glazes: [] });
  const [potteryLoading, setPotteryLoading] = useState(false);
  const [potteryError, setPotteryError] = useState('');
  const [potterySuccess, setPotterySuccess] = useState('');

  // New Pottery Request Form State
  const minPotteryDate = getKolkataDateString(14);
  const [potteryItem, setPotteryItem] = useState('');
  const [potteryGlaze, setPotteryGlaze] = useState('');
  const [potteryQty, setPotteryQty] = useState(2);
  const [potteryDate, setPotteryDate] = useState(minPotteryDate);
  const [potterySubmitting, setPotterySubmitting] = useState(false);

  // Pottery Edit Modal State
  const [editingPottery, setEditingPottery] = useState(null);
  const [editItem, setEditItem] = useState('');
  const [editGlaze, setEditGlaze] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editDate, setEditDate] = useState(minPotteryDate);
  const [editPotteryLoading, setEditPotteryLoading] = useState(false);

  // Load Orders
  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } catch (err) {
      setOrdersError(err.message || 'Failed to load your orders.');
    } finally {
      setOrdersLoading(false);
    }
  }

  // Load Bookings & Booked Dates
  async function loadBookings() {
    setBookingsLoading(true);
    setBookingsError('');
    try {
      const [bData, dData] = await Promise.all([
        api.bookings.getAll(),
        api.bookings.getBookedDates(),
      ]);
      setBookings(bData);
      setBookedDates(dData);
    } catch (err) {
      setBookingsError(err.message || 'Failed to load bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }

  // Load Pottery Catalogue & Requests
  async function loadPottery() {
    setPotteryLoading(true);
    setPotteryError('');
    try {
      const [cData, rData] = await Promise.all([
        api.pottery.getCatalogue(),
        api.pottery.getAll(),
      ]);
      setPotteryCatalogue(cData);
      setPotteryRequests(rData);
      if (cData.items.length > 0 && !potteryItem) setPotteryItem(cData.items[0].id);
      if (cData.glazes.length > 0 && !potteryGlaze) setPotteryGlaze(cData.glazes[0].id);
    } catch (err) {
      setPotteryError(err.message || 'Failed to load pottery data.');
    } finally {
      setPotteryLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'pottery') loadPottery();
  }, [activeTab]);

  // Order Cancellation
  async function handleConfirmCancelOrder() {
    if (!cancellingOrder) return;
    setCancelOrderLoading(true);
    try {
      await api.orders.cancel(cancellingOrder.id);
      setCancellingOrder(null);
      await loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to cancel order.');
    } finally {
      setCancelOrderLoading(false);
    }
  }

  // Wall Booking Creation
  async function handleCreateBooking(e) {
    e.preventDefault();
    setBookingSubmitting(true);
    setBookingsError('');
    setBookingSuccess('');
    try {
      await api.bookings.create({
        bookingDate,
        wallArea: parseFloat(wallArea),
        serviceAddress,
      });
      setBookingSuccess('Wall-painting booking requested successfully! The studio will review and confirm your date.');
      setServiceAddress('');
      await loadBookings();
    } catch (err) {
      setBookingsError(err.message || 'Booking submission failed.');
    } finally {
      setBookingSubmitting(false);
    }
  }

  // Wall Booking Cancellation
  async function handleConfirmCancelBooking() {
    if (!cancellingBooking) return;
    setCancelBookingLoading(true);
    try {
      await api.bookings.cancel(cancellingBooking.id);
      setCancellingBooking(null);
      await loadBookings();
    } catch (err) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setCancelBookingLoading(false);
    }
  }

  // Pottery Request Creation
  async function handleCreatePottery(e) {
    e.preventDefault();
    setPotterySubmitting(true);
    setPotteryError('');
    setPotterySuccess('');
    try {
      await api.pottery.create({
        itemId: potteryItem,
        glazeId: potteryGlaze,
        quantity: parseInt(potteryQty, 10),
        neededByDate: potteryDate,
      });
      setPotterySuccess('Custom pottery request submitted successfully! The studio has received your specifications.');
      await loadPottery();
    } catch (err) {
      setPotteryError(err.message || 'Pottery request submission failed.');
    } finally {
      setPotterySubmitting(false);
    }
  }

  // Pottery Edit Open
  function openEditPotteryModal(req) {
    setEditingPottery(req);
    setEditItem(req.item_id);
    setEditGlaze(req.glaze_id);
    setEditQty(req.quantity);
    setEditDate(req.needed_by_date);
  }

  // Pottery Edit Save
  async function handleSavePotteryEdit(e) {
    e.preventDefault();
    if (!editingPottery) return;
    setEditPotteryLoading(true);
    try {
      await api.pottery.update(editingPottery.id, {
        itemId: editItem,
        glazeId: editGlaze,
        quantity: parseInt(editQty, 10),
        neededByDate: editDate,
      });
      setEditingPottery(null);
      await loadPottery();
    } catch (err) {
      alert(err.message || 'Failed to update pottery request.');
    } finally {
      setEditPotteryLoading(false);
    }
  }

  // Pottery Cancel
  async function handleCancelPottery(requestId) {
    if (!window.confirm('Are you sure you want to cancel this pottery request?')) return;
    try {
      await api.pottery.cancel(requestId);
      await loadPottery();
    } catch (err) {
      alert(err.message || 'Failed to cancel pottery request.');
    }
  }

  // Price calculation for wall booking
  const calculatedPrice = wallArea * 150;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="headline-medium" style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 600 }}>
          Customer Dashboard
        </h1>
        <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          Welcome back, {user?.name}. Manage your one-of-a-kind art orders, wall mural bookings, and custom pottery requests.
        </p>
      </div>

      {/* Tabs */}
      <div className="md-tabs">
        <button
          type="button"
          className={`md-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <span className="material-symbols-outlined">shopping_bag</span>
          My Orders ({orders.length})
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <span className="material-symbols-outlined">format_paint</span>
          Wall-Painting Bookings ({bookings.length})
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'pottery' ? 'active' : ''}`}
          onClick={() => setActiveTab('pottery')}
        >
          <span className="material-symbols-outlined">ceramic</span>
          Custom Pottery ({potteryRequests.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MY ORDERS */}
      {/* ============================================================== */}
      {activeTab === 'orders' && (
        <div>
          <ErrorBanner message={ordersError} onRetry={loadOrders} />

          {ordersLoading ? (
            <LoadingSpinner message="Retrieving your orders..." />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="shopping_bag"
              title="No orders placed yet"
              message="You haven't purchased any paintings from our gallery yet. Browse our authentic handcrafted collection to find your favorite piece!"
            />
          ) : (
            <div className="md-table-container">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>Painting</th>
                    <th>Artist</th>
                    <th>Price</th>
                    <th>Order Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => {
                    const isPlaced = ord.status === 'placed';
                    return (
                      <tr key={ord.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                              src={ord.painting_image_url || 'images/p-001.jpg'}
                              alt={ord.painting_title}
                              style={{ width: '48px', height: '48px', borderRadius: 'var(--md-shape-corner-small)', objectFit: 'cover' }}
                            />
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.875rem' }}>{ord.painting_title}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>ID: {ord.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>{ord.painting_artist}</td>
                        <td>
                          <strong>₹{Number(ord.price).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>{new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <StatusChip status={ord.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isPlaced ? (
                            <button
                              type="button"
                              className="md-btn md-btn-sm md-btn-outlined"
                              onClick={() => setCancellingOrder(ord)}
                              style={{ borderColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-error)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                cancel
                              </span>
                              Cancel Order
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                              Cancelled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: WALL PAINTING BOOKINGS */}
      {/* ============================================================== */}
      {activeTab === 'bookings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Booking Form Card */}
          <div className="md-card md-card-elevated" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)', fontSize: '24px' }}>
                brush
              </span>
              <h3 className="title-medium" style={{ fontWeight: 600 }}>Book Professional Wall Mural</h3>
            </div>

            {bookingsError && (
              <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">error</span>
                <span style={{ fontSize: '0.8125rem' }}>{bookingsError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div className="md-banner md-banner-success" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">check_circle</span>
                <span style={{ fontSize: '0.8125rem' }}>{bookingSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateBooking}>
              <div className="md-form-group">
                <label className="md-label" htmlFor="booking-date">
                  Desired Date (7 to 90 days from today)
                </label>
                <input
                  id="booking-date"
                  type="date"
                  className="md-input"
                  min={minBookingDate}
                  max={maxBookingDate}
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  disabled={bookingSubmitting}
                />
                <span className="md-help-text">
                  Dates already reserved: {bookedDates.length > 0 ? bookedDates.slice(0, 3).join(', ') + (bookedDates.length > 3 ? '...' : '') : 'None currently'}
                </span>
              </div>

              <div className="md-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="md-label" htmlFor="wall-area">
                    Wall Area (10 to 500 sq ft)
                  </label>
                  <span style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>{wallArea} sq ft</span>
                </div>
                <input
                  id="wall-area"
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={wallArea}
                  onChange={(e) => setWallArea(Number(e.target.value))}
                  disabled={bookingSubmitting}
                  style={{ accentColor: 'var(--md-sys-color-primary)', width: '100%', margin: '0.5rem 0' }}
                />
              </div>

              {/* Price Calculation Box */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--md-shape-corner-medium)',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span>Rate: ₹150 / sq ft</span>
                  <span>{wallArea} sq ft</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <span style={{ fontWeight: 600 }}>Estimated Total:</span>
                  <span className="title-medium" style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                    ₹{calculatedPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="md-form-group">
                <label className="md-label" htmlFor="service-address">
                  Service Address & Landmarks
                </label>
                <textarea
                  id="service-address"
                  className="md-textarea"
                  rows={3}
                  required
                  placeholder="Enter complete address where the wall mural will be painted..."
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  disabled={bookingSubmitting}
                />
              </div>

              <button
                type="submit"
                className="md-btn md-btn-filled"
                disabled={bookingSubmitting}
                style={{ width: '100%' }}
              >
                {bookingSubmitting ? 'Reserving Date...' : 'Request Wall Booking'}
              </button>
            </form>
          </div>

          {/* Bookings List */}
          <div>
            <h3 className="title-medium" style={{ fontWeight: 600, marginBottom: '1rem' }}>
              My Scheduled Bookings
            </h3>

            {bookingsLoading ? (
              <LoadingSpinner message="Loading your bookings..." />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon="event_busy"
                title="No bookings requested"
                message="You haven't requested any wall-painting services yet. Fill out the form to reserve an artist!"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bookings.map((b) => {
                  const daysLeft = getDaysRemaining(b.booking_date);
                  const isCancellable = (b.status === 'requested' || b.status === 'confirmed') && daysLeft >= 3;

                  return (
                    <div
                      key={b.id}
                      className="md-card md-card-outlined"
                      style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)', fontSize: '20px' }}>
                              calendar_today
                            </span>
                            <strong style={{ fontSize: '1rem' }}>{b.booking_date}</strong>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                            ID: {b.id} • {daysLeft >= 0 ? `${daysLeft} days away` : 'Past date'}
                          </span>
                        </div>
                        <StatusChip status={b.status} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', padding: '0.5rem 0.75rem', borderRadius: 'var(--md-shape-corner-small)', fontSize: '0.8125rem' }}>
                        <div>
                          <span style={{ color: 'var(--md-sys-color-outline)' }}>Area: </span>
                          <strong>{b.wall_area} sq ft</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--md-sys-color-outline)' }}>Price: </span>
                          <strong>₹{Number(b.total_price).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      <p className="body-medium" style={{ fontSize: '0.8125rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <strong>Address:</strong> {b.service_address}
                      </p>

                      {/* Cancellation controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--md-sys-color-surface-container)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                          {b.status === 'cancelled' || b.status === 'declined'
                            ? `Date released (${b.status})`
                            : daysLeft < 3
                            ? 'Cannot cancel (< 3 days before date)'
                            : 'Cancellable until 3 days before date'}
                        </span>

                        {isCancellable && (
                          <button
                            type="button"
                            className="md-btn md-btn-sm md-btn-outlined"
                            onClick={() => setCancellingBooking(b)}
                            style={{ borderColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-error)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              close
                            </span>
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CUSTOM POTTERY REQUESTS */}
      {/* ============================================================== */}
      {activeTab === 'pottery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Request Form Card */}
          <div className="md-card md-card-elevated" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)', fontSize: '24px' }}>
                ceramic
              </span>
              <h3 className="title-medium" style={{ fontWeight: 600 }}>Request Custom Handcrafted Pottery</h3>
            </div>

            {potteryError && (
              <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">error</span>
                <span style={{ fontSize: '0.8125rem' }}>{potteryError}</span>
              </div>
            )}

            {potterySuccess && (
              <div className="md-banner md-banner-success" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">check_circle</span>
                <span style={{ fontSize: '0.8125rem' }}>{potterySuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreatePottery}>
              <div className="md-form-group">
                <label className="md-label" htmlFor="pottery-item">
                  Pottery Item
                </label>
                <select
                  id="pottery-item"
                  className="md-select"
                  value={potteryItem}
                  onChange={(e) => setPotteryItem(e.target.value)}
                  disabled={potterySubmitting}
                >
                  {potteryCatalogue.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md-form-group">
                <label className="md-label" htmlFor="pottery-glaze">
                  Traditional Glaze Finish
                </label>
                <select
                  id="pottery-glaze"
                  className="md-select"
                  value={potteryGlaze}
                  onChange={(e) => setPotteryGlaze(e.target.value)}
                  disabled={potterySubmitting}
                >
                  {potteryCatalogue.glazes.map((glaze) => (
                    <option key={glaze.id} value={glaze.id}>
                      {glaze.name} ({glaze.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="md-label" htmlFor="pottery-qty">
                    Quantity (1 to 12)
                  </label>
                  <span style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>{potteryQty} units</span>
                </div>
                <input
                  id="pottery-qty"
                  type="number"
                  min="1"
                  max="12"
                  className="md-input"
                  required
                  value={potteryQty}
                  onChange={(e) => setPotteryQty(e.target.value)}
                  disabled={potterySubmitting}
                />
              </div>

              <div className="md-form-group">
                <label className="md-label" htmlFor="pottery-date">
                  Needed-By Date (At least 14 days in future)
                </label>
                <input
                  id="pottery-date"
                  type="date"
                  className="md-input"
                  min={minPotteryDate}
                  required
                  value={potteryDate}
                  onChange={(e) => setPotteryDate(e.target.value)}
                  disabled={potterySubmitting}
                />
                <span className="md-help-text">Clay preparation, wheel turning, sun-drying, and kiln firing require at least 14 days.</span>
              </div>

              <button
                type="submit"
                className="md-btn md-btn-filled"
                disabled={potterySubmitting}
                style={{ width: '100%' }}
              >
                {potterySubmitting ? 'Submitting Request...' : 'Submit Pottery Request'}
              </button>
            </form>
          </div>

          {/* Pottery Requests List */}
          <div>
            <h3 className="title-medium" style={{ fontWeight: 600, marginBottom: '1rem' }}>
              My Pottery Requests
            </h3>

            {potteryLoading ? (
              <LoadingSpinner message="Loading pottery requests..." />
            ) : potteryRequests.length === 0 ? (
              <EmptyState
                icon="ceramic"
                title="No pottery requested"
                message="You have not requested any custom pottery yet. Choose an item and authentic glaze to submit your order!"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {potteryRequests.map((req) => {
                  const isRequested = req.status === 'requested';

                  return (
                    <div
                      key={req.id}
                      className="md-card md-card-outlined"
                      style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', display: 'block' }}>{req.item_name}</strong>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--md-sys-color-primary)' }}>
                            Glaze: {req.glaze_name}
                          </span>
                        </div>
                        <StatusChip status={req.status} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', padding: '0.5rem 0.75rem', borderRadius: 'var(--md-shape-corner-small)', fontSize: '0.8125rem' }}>
                        <div>
                          <span style={{ color: 'var(--md-sys-color-outline)' }}>Quantity: </span>
                          <strong>{req.quantity} units</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--md-sys-color-outline)' }}>Needed By: </span>
                          <strong>{req.needed_by_date}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--md-sys-color-surface-container)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                          {isRequested ? 'Editable & Cancellable' : `Locked (${req.status})`}
                        </span>

                        {isRequested && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="md-btn md-btn-sm md-btn-outlined"
                              onClick={() => openEditPotteryModal(req)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                edit
                              </span>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="md-btn md-btn-sm md-btn-outlined"
                              onClick={() => handleCancelPottery(req.id)}
                              style={{ borderColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-error)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                cancel
                              </span>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM ORDER CANCELLATION MODAL */}
      <Modal
        isOpen={Boolean(cancellingOrder)}
        onClose={() => !cancelOrderLoading && setCancellingOrder(null)}
        title="Confirm Order Cancellation"
      >
        {cancellingOrder && (
          <div>
            <p className="body-medium" style={{ marginBottom: '1rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Are you sure you want to cancel order <strong>{cancellingOrder.id}</strong> for <strong>{cancellingOrder.painting_title}</strong>?
            </p>
            <p className="body-medium" style={{ marginBottom: '1.25rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              This will cancel your order and immediately restore the painting to <strong>available</strong> in the studio gallery for other collectors.
            </p>
            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-text"
                onClick={() => setCancellingOrder(null)}
                disabled={cancelOrderLoading}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="md-btn md-btn-danger"
                onClick={handleConfirmCancelOrder}
                disabled={cancelOrderLoading}
              >
                {cancelOrderLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM BOOKING CANCELLATION MODAL */}
      <Modal
        isOpen={Boolean(cancellingBooking)}
        onClose={() => !cancelBookingLoading && setCancellingBooking(null)}
        title="Confirm Booking Cancellation"
      >
        {cancellingBooking && (
          <div>
            <p className="body-medium" style={{ marginBottom: '1rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Are you sure you want to cancel your wall-painting booking for <strong>{cancellingBooking.booking_date}</strong>?
            </p>
            <p className="body-medium" style={{ marginBottom: '1.25rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              The reserved date will be permanently released and made available for other studio clients.
            </p>
            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-text"
                onClick={() => setCancellingBooking(null)}
                disabled={cancelBookingLoading}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="md-btn md-btn-danger"
                onClick={handleConfirmCancelBooking}
                disabled={cancelBookingLoading}
              >
                {cancelBookingLoading ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT POTTERY REQUEST MODAL */}
      <Modal
        isOpen={Boolean(editingPottery)}
        onClose={() => !editPotteryLoading && setEditingPottery(null)}
        title="Edit Pottery Request"
      >
        {editingPottery && (
          <form onSubmit={handleSavePotteryEdit}>
            <div className="md-form-group">
              <label className="md-label">Pottery Item</label>
              <select
                className="md-select"
                value={editItem}
                onChange={(e) => setEditItem(e.target.value)}
                disabled={editPotteryLoading}
              >
                {potteryCatalogue.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md-form-group">
              <label className="md-label">Glaze Finish</label>
              <select
                className="md-select"
                value={editGlaze}
                onChange={(e) => setEditGlaze(e.target.value)}
                disabled={editPotteryLoading}
              >
                {potteryCatalogue.glazes.map((glaze) => (
                  <option key={glaze.id} value={glaze.id}>
                    {glaze.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md-form-group">
              <label className="md-label">Quantity (1 to 12)</label>
              <input
                type="number"
                min="1"
                max="12"
                className="md-input"
                required
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                disabled={editPotteryLoading}
              />
            </div>

            <div className="md-form-group">
              <label className="md-label">Needed-By Date (At least 14 days in future)</label>
              <input
                type="date"
                className="md-input"
                min={minPotteryDate}
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                disabled={editPotteryLoading}
              />
            </div>

            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-text"
                onClick={() => setEditingPottery(null)}
                disabled={editPotteryLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="md-btn md-btn-filled"
                disabled={editPotteryLoading}
              >
                {editPotteryLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
