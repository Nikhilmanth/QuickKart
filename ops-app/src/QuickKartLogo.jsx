import React from 'react';

export default function QuickKartLogo({ size = 'md', subtitle = '', inverted = false }) {
  const isSm = size === 'sm';
  const iconDim = isSm ? 26 : 32;
  const fontSize = isSm ? '19px' : '23px';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 512 512"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="qkCartGradOps" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c831f" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="qkBoltGradOps" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="130" fill="url(#qkCartGradOps)" />
        <g fill="none" stroke="#ffffff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
          <path d="M105 140 h55 l45 180 h170 l35 -130 H190" />
          <circle cx="215" cy="390" r="24" fill="#ffffff" stroke="none" />
          <circle cx="365" cy="390" r="24" fill="#ffffff" stroke="none" />
        </g>
        <polygon points="295,100 240,210 295,210 255,305 355,180 295,180" fill="url(#qkBoltGradOps)" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <div
          style={{
            fontSize,
            fontWeight: 900,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '-0.8px',
            display: 'flex',
          }}
        >
          <span style={{ color: inverted ? '#fbbf24' : '#f59e0b' }}>quick</span>
          <span style={{ color: inverted ? '#ffffff' : '#0c831f' }}>kart</span>
        </div>
        {subtitle && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              background: '#ecfdf5',
              color: '#059669',
              padding: '2px 7px',
              borderRadius: '6px',
              border: '1px solid #a7f3d0',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
