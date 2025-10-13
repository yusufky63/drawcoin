import React from 'react';

interface HandDrawnIconProps {
  type: 'brush' | 'image' | 'coin' | 'check' | 'error' | 'loading' | 'upload' | 'draw' | 'paint' | 'art';
  className?: string;
  size?: number;
}

const HandDrawnIcon: React.FC<HandDrawnIconProps> = ({ 
  type, 
  className = '', 
  size = 24 
}) => {
  const iconPaths = {
    brush: (
      <g>
        <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z" />
        <path d="M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z" />
      </g>
    ),
    image: (
      <g>
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </g>
    ),
    coin: (
      <g>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
        <circle cx="12" cy="12" r="3" />
      </g>
    ),
    check: (
      <g>
        <path d="M20 6L9 17l-5-5" />
      </g>
    ),
    error: (
      <g>
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </g>
    ),
    loading: (
      <g>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </g>
    ),
    upload: (
      <g>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </g>
    ),
    draw: (
      <g>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </g>
    ),
    paint: (
      <g>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </g>
    ),
    art: (
      <g>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </g>
    )
  };

  return (
    <svg
      className={`hand-drawn-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.1))',
        transform: 'rotate(-1deg)',
        transition: 'transform 0.2s ease'
      }}
    >
      {iconPaths[type] || iconPaths.art}
    </svg>
  );
};

export default HandDrawnIcon;
