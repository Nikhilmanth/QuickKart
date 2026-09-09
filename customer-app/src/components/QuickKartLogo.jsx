import React from 'react';

export default function QuickKartLogo({ size = 'md', showTagline = false, inverted = false, className = '' }) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';
  const isXl = size === 'xl';

  const iconDim = isSm ? 26 : isXl ? 40 : isLg ? 34 : 30;
  const fontSize = isSm ? '20px' : isXl ? '32px' : isLg ? '26px' : '23px';

  return (
    <div
      className={`qk-brand-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none',
        cursor: 'pointer',
      }}
    >
      {/* Brand Icon (Express Lightning Cart) */}
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 512 512"
        style={{
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 5px rgba(12,131,31,0.25))',
        }}
      >
        <defs>
          <linearGradient id="qkCartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c831f" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="qkBoltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="130" fill="url(#qkCartGrad)" />
        <g fill="none" stroke="#ffffff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
          <path d="M105 140 h55 l45 180 h170 l35 -130 H190" />
          <circle cx="215" cy="390" r="24" fill="#ffffff" stroke="none" />
          <circle cx="365" cy="390" r="24" fill="#ffffff" stroke="none" />
        </g>
        <polygon points="295,100 240,210 295,210 255,305 355,180 295,180" fill="url(#qkBoltGrad)" />
      </svg>

      {/* Authentic Blinkit-style bold rounded wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 900,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            letterSpacing: '-0.8px',
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: inverted ? '#fbbf24' : '#f59e0b' }}>quick</span>
          <span style={{ color: inverted ? '#ffffff' : '#0c831f' }}>kart</span>
        </div>
        {showTagline && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1px',
              color: inverted ? 'rgba(255,255,255,0.85)' : '#64748b',
              marginTop: '3px',
            }}
          >
            Groceries. Delivered Quickly.
          </span>
        )}
      </div>
    </div>
  );
}
