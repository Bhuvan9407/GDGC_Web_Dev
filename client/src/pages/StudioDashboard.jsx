import React, { useState, useEffect } from 'react';
import StatusChip from '../components/StatusChip';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { api } from '../api';

export default function StudioDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'paintings' | 'bookings' | 'pottery'

  // Orders State
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  // Paintings State
  const [paintings, setPaintings] = useState([]);
  const [paintingsLoading, setPaintingsLoading] = useState(false);
  const [paintingsError, setPaintingsError] = useState('');
  const [editingPainting, setEditingPainting] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Add Painting State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('images/p-001.jpg');
  const [addLoading, setAddLoading] = useState(false);

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');

  // Pottery Requests State
  const [potteryRequests, setPotteryRequests] = useState([]);
  const [potteryLoading, setPotteryLoading] = useState(false);
  const [potteryError, setPotteryError] = useState('');

  // Loaders
  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } catch (err) {
      setOrdersError(err.message || 'Failed to load studio orders.');
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadPaintings() {
    setPaintingsLoading(true);
    setPaintingsError('');
    try {
      const data = await api.paintings.getAll();
      setPaintings(data);
    } catch (err) {
      setPaintingsError(err.message || 'Failed to load paintings.');
    } finally {
      setPaintingsLoading(false);
    }
  }

  async function loadBookings() {
    setBookingsLoading(true);
    setBookingsError('');
    try {
      const data = await api.bookings.getAll();
      setBookings(data);
    } catch (err) {
      setBookingsError(err.message || 'Failed to load wall bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }

  async function loadPottery() {
    setPotteryLoading(true);
    setPotteryError('');
    try {
      const data = await api.pottery.getAll();
      setPotteryRequests(data);
    } catch (err) {
      setPotteryError(err.message || 'Failed to load pottery requests.');
    } finally {
      setPotteryLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'paintings') loadPaintings();
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'pottery') loadPottery();
  }, [activeTab]);

  // Painting Edit (Available only)
  function openEditModal(painting) {
    if (painting.status === 'sold') {
      alert('Sold paintings cannot be edited per studio business rules.');
      return;
    }
    setEditingPainting(painting);
    setEditTitle(painting.title);
    setEditArtist(painting.artist);
    setEditPrice(painting.price);
    setEditDescription(painting.description);
    setEditImageUrl(painting.imageUrl || '');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingPainting) return;
    setEditLoading(true);
    try {
      await api.paintings.update(editingPainting.id, {
        title: editTitle,
        artist: editArtist,
        price: parseFloat(editPrice),
        description: editDescription,
        imageUrl: editImageUrl,
      });
      setEditingPainting(null);
      await loadPaintings();
    } catch (err) {
      alert(err.message || 'Failed to update painting.');
    } finally {
      setEditLoading(false);
    }
  }

  // Painting Add
  async function handleAddPainting(e) {
    e.preventDefault();
    setAddLoading(true);
    try {
      await api.paintings.create({
        title: newTitle,
        artist: newArtist,
        price: parseFloat(newPrice),
        description: newDescription,
        imageUrl: newImageUrl,
      });
      setIsAddOpen(false);
      setNewTitle('');
      setNewArtist('');
      setNewPrice('');
      setNewDescription('');
      await loadPaintings();
    } catch (err) {
      alert(err.message || 'Failed to add painting.');
    } finally {
      setAddLoading(false);
    }
  }

  // Booking Status (Confirm / Decline)
  async function handleBookingStatus(bookingId, status) {
    if (!window.confirm(`Are you sure you want to mark this booking as ${status}?`)) return;
    try {
      await api.bookings.updateStatus(bookingId, status);
      await loadBookings();
    } catch (err) {
      alert(err.message || `Failed to update booking to ${status}.`);
    }
  }

  // Pottery Status (Accept / Decline)
  async function handlePotteryStatus(requestId, status) {
    if (!window.confirm(`Are you sure you want to mark this pottery request as ${status}?`)) return;
    try {
      await api.pottery.updateStatus(requestId, status);
      await loadPottery();
    } catch (err) {
      alert(err.message || `Failed to update pottery request to ${status}.`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className="headline-medium" style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 600 }}>
              Studio Administration
            </h1>
            <span className="md-role-chip">Studio Admin</span>
          </div>
          <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Oversee paintings inventory, manage customer orders, confirm wall-painting bookings, and review pottery requests.
          </p>
        </div>

        {activeTab === 'paintings' && (
          <button type="button" className="md-btn md-btn-filled" onClick={() => setIsAddOpen(true)}>
            <span className="material-symbols-outlined">add</span>
            Add Painting
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="md-tabs">
        <button
          type="button"
          className={`md-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <span className="material-symbols-outlined">receipt_long</span>
          All Customer Orders ({orders.length})
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'paintings' ? 'active' : ''}`}
          onClick={() => setActiveTab('paintings')}
        >
          <span className="material-symbols-outlined">palette</span>
          Paintings Inventory ({paintings.length})
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <span className="material-symbols-outlined">format_paint</span>
          Wall Bookings ({bookings.length})
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'pottery' ? 'active' : ''}`}
          onClick={() => setActiveTab('pottery')}
        >
          <span className="material-symbols-outlined">ceramic</span>
          Pottery Requests ({potteryRequests.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: ALL ORDERS */}
      {/* ============================================================== */}
      {activeTab === 'orders' && (
        <div>
          <ErrorBanner message={ordersError} onRetry={loadOrders} />

          {ordersLoading ? (
            <LoadingSpinner message="Loading all customer orders..." />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              title="No customer orders yet"
              message="When customers purchase available paintings, their orders will appear here."
            />
          ) : (
            <div className="md-table-container">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer Name & Email</th>
                    <th>Painting</th>
                    <th>Price</th>
                    <th>Date Placed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td>
                        <strong>{ord.id}</strong>
                      </td>
                      <td>
                        <strong style={{ display: 'block' }}>{ord.customer_name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>{ord.customer_email}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img
                            src={ord.painting_image_url || 'images/p-001.jpg'}
                            alt={ord.painting_title}
                            style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
                          />
                          <span>{ord.painting_title}</span>
                        </div>
                      </td>
                      <td>
                        <strong>₹{Number(ord.price).toLocaleString('en-IN')}</strong>
                      </td>
                      <td>{new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>
                        <StatusChip status={ord.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PAINTINGS INVENTORY */}
      {/* ============================================================== */}
      {activeTab === 'paintings' && (
        <div>
          <ErrorBanner message={paintingsError} onRetry={loadPaintings} />

          {paintingsLoading ? (
            <LoadingSpinner message="Loading inventory..." />
          ) : (
            <div className="md-table-container">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>Painting</th>
                    <th>Artist</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paintings.map((p) => {
                    const isAvailable = p.status === 'available';
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                              src={p.imageUrl || 'images/p-001.jpg'}
                              alt={p.title}
                              style={{ width: '48px', height: '48px', borderRadius: 'var(--md-shape-corner-small)', objectFit: 'cover' }}
                            />
                            <div>
                              <strong style={{ display: 'block' }}>{p.title}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>ID: {p.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>{p.artist}</td>
                        <td>
                          <strong>₹{Number(p.price).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          <StatusChip status={p.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isAvailable ? (
                            <button
                              type="button"
                              className="md-btn md-btn-sm md-btn-outlined"
                              onClick={() => openEditModal(p)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                edit
                              </span>
                              Edit Details
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', fontStyle: 'italic' }}>
                              Sold (Locked)
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
      {/* TAB 3: WALL BOOKINGS */}
      {/* ============================================================== */}
      {activeTab === 'bookings' && (
        <div>
          <ErrorBanner message={bookingsError} onRetry={loadBookings} />

          {bookingsLoading ? (
            <LoadingSpinner message="Loading bookings..." />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon="format_paint"
              title="No wall bookings requested"
              message="Customer requests for wall-painting dates will appear here for confirmation."
            />
          ) : (
            <div className="md-table-container">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Scheduled Date</th>
                    <th>Area & Total</th>
                    <th>Service Address</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Studio Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const isRequested = b.status === 'requested';

                    return (
                      <tr key={b.id}>
                        <td>
                          <strong style={{ display: 'block' }}>{b.customer_name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>{b.customer_email}</span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.9375rem' }}>{b.booking_date}</strong>
                        </td>
                        <td>
                          <div>{b.wall_area} sq ft</div>
                          <strong style={{ color: 'var(--md-sys-color-primary)' }}>
                            ₹{Number(b.total_price).toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td style={{ maxWidth: '250px', fontSize: '0.8125rem' }}>{b.service_address}</td>
                        <td>
                          <StatusChip status={b.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isRequested ? (
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="md-btn md-btn-sm"
                                onClick={() => handleBookingStatus(b.id, 'confirmed')}
                                style={{ backgroundColor: '#137333', color: '#fff' }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="md-btn md-btn-sm md-btn-danger"
                                onClick={() => handleBookingStatus(b.id, 'declined')}
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                              Processed ({b.status})
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
      {/* TAB 4: POTTERY REQUESTS */}
      {/* ============================================================== */}
      {activeTab === 'pottery' && (
        <div>
          <ErrorBanner message={potteryError} onRetry={loadPottery} />

          {potteryLoading ? (
            <LoadingSpinner message="Loading pottery requests..." />
          ) : potteryRequests.length === 0 ? (
            <EmptyState
              icon="ceramic"
              title="No pottery requests"
              message="Custom pottery requests from customers will appear here."
            />
          ) : (
            <div className="md-table-container">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Pottery Item & Glaze</th>
                    <th>Quantity</th>
                    <th>Needed By</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Studio Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {potteryRequests.map((req) => {
                    const isRequested = req.status === 'requested';

                    return (
                      <tr key={req.id}>
                        <td>
                          <strong style={{ display: 'block' }}>{req.customer_name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>{req.customer_email}</span>
                        </td>
                        <td>
                          <strong>{req.item_name}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                            Glaze: {req.glaze_name}
                          </span>
                        </td>
                        <td>{req.quantity} units</td>
                        <td>
                          <strong>{req.needed_by_date}</strong>
                        </td>
                        <td>
                          <StatusChip status={req.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isRequested ? (
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="md-btn md-btn-sm"
                                onClick={() => handlePotteryStatus(req.id, 'accepted')}
                                style={{ backgroundColor: '#137333', color: '#fff' }}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="md-btn md-btn-sm md-btn-danger"
                                onClick={() => handlePotteryStatus(req.id, 'declined')}
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                              Processed ({req.status})
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

      {/* EDIT PAINTING MODAL */}
      <Modal
        isOpen={Boolean(editingPainting)}
        onClose={() => !editLoading && setEditingPainting(null)}
        title="Edit Painting Details"
      >
        {editingPainting && (
          <form onSubmit={handleSaveEdit}>
            <div className="md-form-group">
              <label className="md-label">Title</label>
              <input
                type="text"
                className="md-input"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="md-form-group">
              <label className="md-label">Artist</label>
              <input
                type="text"
                className="md-input"
                required
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="md-form-group">
              <label className="md-label">Price (INR)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="md-input"
                required
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="md-form-group">
              <label className="md-label">Description</label>
              <textarea
                className="md-textarea"
                rows={3}
                required
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="md-form-group">
              <label className="md-label">Image Path</label>
              <input
                type="text"
                className="md-input"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-text"
                onClick={() => setEditingPainting(null)}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="md-btn md-btn-filled"
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ADD PAINTING MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => !addLoading && setIsAddOpen(false)}
        title="Add New Painting to Catalogue"
      >
        <form onSubmit={handleAddPainting}>
          <div className="md-form-group">
            <label className="md-label">Painting Title</label>
            <input
              type="text"
              className="md-input"
              required
              placeholder="e.g., Royal Bengal Tiger in Sundarbans"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={addLoading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label">Artist Name</label>
            <input
              type="text"
              className="md-input"
              required
              placeholder="e.g., Rajeshwar Rao"
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
              disabled={addLoading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label">Price (INR)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="md-input"
              required
              placeholder="e.g., 14500"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={addLoading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label">Description</label>
            <textarea
              className="md-textarea"
              rows={3}
              required
              placeholder="Medium, style, dimensions, and subject matter..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={addLoading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label">Image Path</label>
            <input
              type="text"
              className="md-input"
              placeholder="images/p-001.jpg"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              disabled={addLoading}
            />
          </div>

          <div className="md-dialog-actions">
            <button
              type="button"
              className="md-btn md-btn-text"
              onClick={() => setIsAddOpen(false)}
              disabled={addLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="md-btn md-btn-filled"
              disabled={addLoading}
            >
              {addLoading ? 'Creating...' : 'Add Painting'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
