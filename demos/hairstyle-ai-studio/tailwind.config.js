/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Full violet-based primary scale (fixes previously-undefined primary-100..900 shades).
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          350: '#b3a1fc',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dark: '#6d28d9',
        },
        'background-light': '#f8fafc',
        'background-dark': '#0f172a',
        'card-light': '#ffffff',
        'card-dark': '#1e293b',
        // Non-standard slate/gray/red steps referenced throughout the UI.
        slate: {
          150: '#e9eef4',
          250: '#d3dbe6',
          350: '#9fadc0',
          450: '#7c8ba1',
          550: '#556376',
          650: '#3d4757',
          750: '#293241',
          850: '#172033',
        },
        gray: {
          150: '#ececef',
        },
        red: {
          250: '#f7b0b0',
        },
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        glow: '0 0 20px rgba(124, 58, 237, 0.3)',
      },
      zIndex: {
        45: '45',
      },
    },
  },
  plugins: [],
};
