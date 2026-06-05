/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Brand-Farben kommen zur Laufzeit aus der Branchen-Config (CSS-Variablen),
      // damit dasselbe Build je nach VERTICAL anders aussieht.
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
        },
      },
    },
  },
  plugins: [],
};
