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
        slate: {
          850: '#182234',
          900: '#0f172a',
          950: '#0B0F17'
        }
      }
    },
  },
  plugins: [],
}
