import React, { useState, useEffect } from 'react';
import PaintingCard from '../components/PaintingCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { api } from '../api';

export default function CataloguePage({ user, onAuthRequired, onNavigateToOrders }) {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'available' | 'sold'

  // Purchase modal state
  const [purchasingPainting, setPurchasingPainting] = useState(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);

  // Studio Edit modal state
  const [editingPainting, setEditingPainting] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Studio Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('images/p-001.jpg');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  async function loadPaintings() {
    setLoading(true);
    setError('');
    try {
      const data = await api.paintings.getAll();
      setPaintings(data);
    } catch (err) {
      setError(err.message || 'Failed to load paintings from studio catalogue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPaintings();
  }, []);

  // Purchase Handlers
  function openPurchaseModal(painting) {
    if (!user) {
      onAuthRequired();
      return;
    }
    setPurchasingPainting(painting);
    setPurchaseError('');
    setPurchaseSuccess(null);
  }

  async function confirmPurchase() {
    if (!purchasingPainting) return;
    setPurchaseLoading(true);
    setPurchaseError('');
    try {
      const res = await api.orders.create(purchasingPainting.id);
      setPurchaseSuccess(res.order);
      // Immediately refresh paintings catalogue to reflect 'sold' state
      await loadPaintings();
    } catch (err) {
      setPurchaseError(err.message || 'Could not complete purchase.');
    } finally {
      setPurchaseLoading(false);
    }
  }

  // Edit Handlers (Studio only)
  function openEditModal(painting) {
    setEditingPainting(painting);
    setEditTitle(painting.title);
    setEditArtist(painting.artist);
    setEditPrice(painting.price);
    setEditDescription(painting.description);
    setEditImageUrl(painting.imageUrl || '');
    setEditError('');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingPainting) return;
    setEditLoading(true);
    setEditError('');
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
      setEditError(err.message || 'Failed to update painting.');
    } finally {
      setEditLoading(false);
    }
  }

  // Add Handlers (Studio only)
  async function handleAddPainting(e) {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
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
      setAddError(err.message || 'Failed to add painting.');
    } finally {
      setAddLoading(false);
    }
  }

  // Filtering
  const filteredPaintings = paintings.filter((p) => {
    if (filter === 'available') return p.status === 'available';
    if (filter === 'sold') return p.status === 'sold';
    return true;
  });

  return (
    <div>
      {/* Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface-container) 100%)',
          borderRadius: 'var(--md-shape-corner-xl)',
          padding: '2rem 1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        <div style={{ maxWidth: '800px' }}>
          <span className="md-role-chip" style={{ marginBottom: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>brush</span>
            One-of-a-Kind Artworks
          </span>
          <h1 className="display-large" style={{ color: 'var(--md-sys-color-on-primary-container)', fontWeight: 700, margin: '0.25rem 0 0.5rem 0' }}>
            Traditional Indian Masterpieces
          </h1>
          <p className="body-large" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Each painting in our studio is an authentic, handcrafted original. Once purchased, a painting is permanently reserved for its collector.
          </p>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className={`md-btn md-btn-sm ${filter === 'all' ? 'md-btn-filled' : 'md-btn-outlined'}`}
            onClick={() => setFilter('all')}
          >
            All Paintings ({paintings.length})
          </button>
          <button
            type="button"
            className={`md-btn md-btn-sm ${filter === 'available' ? 'md-btn-filled' : 'md-btn-outlined'}`}
            onClick={() => setFilter('available')}
          >
            Available ({paintings.filter((p) => p.status === 'available').length})
          </button>
          <button
            type="button"
            className={`md-btn md-btn-sm ${filter === 'sold' ? 'md-btn-filled' : 'md-btn-outlined'}`}
            onClick={() => setFilter('sold')}
          >
            Sold ({paintings.filter((p) => p.status === 'sold').length})
          </button>
        </div>

        {/* Studio Add Button */}
        {user && user.role === 'studio' && (
          <button
            type="button"
            className="md-btn md-btn-filled"
            onClick={() => setIsAddOpen(true)}
          >
            <span className="material-symbols-outlined">add</span>
            Add New Painting
          </button>
        )}
      </div>

      {/* Feedback banner */}
      <ErrorBanner message={error} onRetry={loadPaintings} />

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Fetching original studio paintings..." />
      ) : filteredPaintings.length === 0 ? (
        <EmptyState
          icon="art_track"
          title="No paintings found"
          message={`There are no paintings matching the '${filter}' filter.`}
          actionLabel="Show All Paintings"
          onAction={() => setFilter('all')}
        />
      ) : (
        <div className="paintings-grid">
          {filteredPaintings.map((painting) => (
            <PaintingCard
              key={painting.id}
              painting={painting}
              user={user}
              onBuy={openPurchaseModal}
              onEdit={openEditModal}
              onAuthRequired={onAuthRequired}
            />
          ))}
        </div>
      )}

      {/* PURCHASE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(purchasingPainting)}
        onClose={() => !purchaseLoading && setPurchasingPainting(null)}
        title={purchaseSuccess ? 'Purchase Confirmed!' : 'Confirm Art Purchase'}
      >
        {purchasingPainting && !purchaseSuccess && (
          <div>
            {purchaseError && (
              <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">error</span>
                <span style={{ fontSize: '0.8125rem' }}>{purchaseError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
              <img
                src={purchasingPainting.imageUrl || 'images/p-001.jpg'}
                alt={purchasingPainting.title}
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--md-shape-corner-medium)' }}
              />
              <div>
                <h4 className="title-medium" style={{ fontWeight: 600 }}>{purchasingPainting.title}</h4>
                <p className="body-medium" style={{ color: 'var(--md-sys-color-primary)' }}>by {purchasingPainting.artist}</p>
                <p className="title-medium" style={{ fontWeight: 700, marginTop: '0.25rem' }}>
                  ₹{Number(purchasingPainting.price).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '1.25rem' }}>
              Each painting is a unique original. Confirming this purchase will place an order under your account and mark the painting as sold in the studio catalogue.
            </p>

            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-text"
                onClick={() => setPurchasingPainting(null)}
                disabled={purchaseLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="md-btn md-btn-filled"
                onClick={confirmPurchase}
                disabled={purchaseLoading}
              >
                {purchaseLoading ? 'Placing Order...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        )}

        {purchaseSuccess && (
          <div>
            <div className="md-banner md-banner-success" style={{ marginBottom: '1rem' }}>
              <span className="material-symbols-outlined">check_circle</span>
              <span>Your order <strong>{purchaseSuccess.id}</strong> has been created!</span>
            </div>
            <p className="body-medium" style={{ marginBottom: '1.5rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Thank you for purchasing <strong>{purchasingPainting?.title}</strong>. You can view or manage your order anytime from your customer dashboard.
            </p>
            <div className="md-dialog-actions">
              <button
                type="button"
                className="md-btn md-btn-tonal"
                onClick={() => {
                  setPurchasingPainting(null);
                  setPurchaseSuccess(null);
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="md-btn md-btn-filled"
                onClick={() => {
                  setPurchasingPainting(null);
                  setPurchaseSuccess(null);
                  if (onNavigateToOrders) onNavigateToOrders();
                }}
              >
                Go to My Orders
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* STUDIO EDIT PAINTING MODAL */}
      <Modal
        isOpen={Boolean(editingPainting)}
        onClose={() => !editLoading && setEditingPainting(null)}
        title="Edit Painting Details"
      >
        {editingPainting && (
          <form onSubmit={handleSaveEdit}>
            {editError && (
              <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                <span className="material-symbols-outlined">error</span>
                <span style={{ fontSize: '0.8125rem' }}>{editError}</span>
              </div>
            )}

            <div className="md-form-group">
              <label className="md-label">Painting Title</label>
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
              <label className="md-label">Artist Name</label>
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
                step="1"
                min="1"
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
              <label className="md-label">Image Path / URL</label>
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

      {/* STUDIO ADD PAINTING MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => !addLoading && setIsAddOpen(false)}
        title="Add New Painting to Catalogue"
      >
        <form onSubmit={handleAddPainting}>
          {addError && (
            <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
              <span className="material-symbols-outlined">error</span>
              <span style={{ fontSize: '0.8125rem' }}>{addError}</span>
            </div>
          )}

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
              step="1"
              min="1"
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
