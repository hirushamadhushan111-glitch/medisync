/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          navy:   '#1E3A8A',
          blue:   '#2563EB',
          'blue-hover': '#1D4ED8',
          'blue-light': '#EFF6FF',
          yellow: '#FBBF24',
          'yellow-dark': '#D97706',
          'yellow-light': '#FEF9C3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
