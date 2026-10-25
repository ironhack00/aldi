/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Paleta del producto en un solo lugar: cambiarla aca cambia toda la app.
      colors: {
        marca: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          950: '#2e1065',
        },
      },
    },
  },
  plugins: [],
};
