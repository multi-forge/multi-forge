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
        forge: {
          bg: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          'surface-2': 'var(--bg-surface-secondary)',
          'surface-3': 'var(--bg-surface-tertiary)',
          border: 'var(--border-subtle)',
          'border-hover': 'var(--border-default)',
          primary: 'var(--accent)',
          'primary-hover': 'var(--accent-hover)',
          'primary-dim': 'var(--accent-dim)',
          accent: 'var(--accent-secondary)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
        },
      },
      width: {
        'sidebar': '240px',
      },
      spacing: {
        'sidebar': '240px',
      },
    },
  },
  plugins: [],
}
