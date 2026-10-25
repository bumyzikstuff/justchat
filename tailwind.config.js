/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
        },
        tg: {
          blue: '#2AABEE',
          dark: '#17212b',
          darker: '#0e1621',
          bubble: '#2b5278',
          text: '#f5f5f5',
          muted: '#7f8b99',
          border: '#242f3d'
        }
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-bar': 'wave 1s ease-in-out infinite alternate',
      },
      keyframes: {
        wave: {
          '0%': { height: '20%' },
          '100%': { height: '100%' }
        }
      }
    },
  },
  plugins: [],
}
