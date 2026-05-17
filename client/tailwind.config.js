/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0d0d1a',
          900: '#1a1a2e',
          800: '#16213e',
          700: '#0f3460',
          600: '#1a4a7a',
        },
        accent: {
          DEFAULT: '#e94560',
          dark:    '#c73652',
          light:   '#ff6b84',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
