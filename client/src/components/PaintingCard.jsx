import React, { useState } from 'react';
import StatusChip from './StatusChip';

export default function PaintingCard({ painting, user, onBuy, onEdit, onAuthRequired }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isAvailable = painting.status === 'available';

  // Format price in Indian Rupees
  const formattedPrice = `₹${Number(painting.price).toLocaleString('en-IN')}`;

  // Check description length
  const isLong = painting.description && painting.description.length > 120;
  const displayDescription = isLong && !isExpanded
    ? `${painting.description.slice(0, 120)}...`
    : painting.description;

  return (
    <article className="md-card md-card-elevated" aria-label={painting.title}>
      <div style={{ position: 'relative', width: '100%', height: '220px', overflow: 'hidden', backgroundColor: 'var(--md-sys-color-surface-container)' }}>
        <img
          src={painting.imageUrl || 'images/p-001.jpg'}
          alt={painting.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80';
          }}
        />
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <StatusChip status={painting.status} />
        </div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.5rem' }}>
        <div>
          <h3 className="title-medium" style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 600 }}>
            {painting.title}
          </h3>
          <p className="body-medium" style={{ color: 'var(--md-sys-color-primary)', fontWeight: 500 }}>
            by {painting.artist}
          </p>
        </div>

        <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', flex: 1 }}>
          {displayDescription}
          {isLong && (
            <button
              type="button"
              className="md-btn-text"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ padding: '0 4px', height: 'auto', display: 'inline', fontSize: '0.8125rem' }}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--md-sys-color-surface-container-high)' }}>
          <span className="title-large" style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 700 }}>
            {formattedPrice}
          </span>

          <div>
            {/* If painting is sold */}
            {!isAvailable && (
              <button type="button" className="md-btn md-btn-sm" disabled style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', color: 'var(--md-sys-color-outline)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  lock
                </span>
                Sold
              </button>
            )}

            {/* If painting is available */}
            {isAvailable && (
              <>
                {/* Guest user */}
                {!user && (
                  <button
                    type="button"
                    className="md-btn md-btn-sm md-btn-tonal"
                    onClick={() => onAuthRequired && onAuthRequired()}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      login
                    </span>
                    Log in to Buy
                  </button>
                )}

                {/* Authenticated Customer */}
                {user && user.role === 'customer' && (
                  <button
                    type="button"
                    className="md-btn md-btn-sm md-btn-filled"
                    onClick={() => onBuy && onBuy(painting)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      shopping_bag
                    </span>
                    Buy Now
                  </button>
                )}

                {/* Studio User */}
                {user && user.role === 'studio' && (
                  <button
                    type="button"
                    className="md-btn md-btn-sm md-btn-outlined"
                    onClick={() => onEdit && onEdit(painting)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      edit
                    </span>
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
