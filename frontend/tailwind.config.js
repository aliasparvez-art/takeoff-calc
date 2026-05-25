/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        qto: {
          bg: '#0F172A',
          surface: '#1E293B',
          'surface-hover': '#334155',
          'surface-active': '#475569',
          primary: '#F59E0B',
          'primary-hover': '#D97706',
          'primary-text': '#0F172A',
          'text-primary': '#F8FAFC',
          'text-secondary': '#94A3B8',
          border: '#334155',
          'border-focus': '#F59E0B',
          success: '#10B981',
          error: '#EF4444',
        },
      },
      fontFamily: {
        heading: ['Chivo', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'qto': '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};