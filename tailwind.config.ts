import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			// Minimalist Art Theme Colors
        'art-white': '#ffffff',
        'art-off-white': '#fefefe',
        'art-gray': {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        'art-accent': {
          blue: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
        },
        // Legacy colors for compatibility
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
        },
        accent: 'var(--accent)',
        gray: {
          light: 'var(--gray-light)',
          mid: 'var(--gray-mid)',
          dark: 'var(--gray-dark)',
        },
        success: 'var(--success)',
        error: 'var(--error)',
        // Retro theme colors (keeping for compatibility)
        'retro-primary': 'var(--retro-primary)',
        'retro-secondary': 'var(--retro-secondary)',
        'retro-accent': 'var(--retro-accent)',
        'retro-dark': 'var(--retro-dark)',
        'retro-darker': 'var(--retro-darker)',
        'retro-light': 'var(--retro-light)',
        'retro-border': 'var(--retro-border)',
        'retro-success': 'var(--retro-success)',
        'retro-error': 'var(--retro-error)',
  		},
  		borderRadius: {
        // Art theme border radius
        'art': '8px',
        'art-lg': '12px',
        'art-xl': '16px',
        // Legacy
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 2px)',
        '2xl': 'calc(var(--radius) + 4px)',
  		},
      fontFamily: {
        // Art theme typography
        'art-sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'art-display': ['var(--font-playfair)', 'serif'],
        'art-serif': ['var(--font-crimson)', 'serif'],
        'art-elegant': ['var(--font-playfair)', 'serif'],
        // Legacy
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['VT323', 'Courier New', 'monospace'],
        pixel: ['"Press Start 2P"', 'Courier New', 'monospace'],
      },
      boxShadow: {
        // Art theme shadows
        'art': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'art-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'art-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        // Legacy
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'retro': '5px 5px 0 rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scanline': 'scanline 4s linear infinite',
        'blink': 'blink 1s steps(1) infinite',
      },
      backdropBlur: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      zIndex: {
        'badge': '50',
        'overlay': '20',
        'modal': '100',
        'dropdown': '40',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scanline: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
