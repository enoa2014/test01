const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './miniprogram/**/*.{wxml,js,ts,json,wxs}',
    './cloudfunctions/**/*.js',
    './docs/**/*.{md,mdx}',
    './miniprogram/styles/tailwind.input.css',
  ],
  theme: {
    extend: {
      colors: {
        'bg-default': 'rgb(var(--bg-default) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        divider: {
          DEFAULT: 'rgb(var(--divider) / <alpha-value>)',
          cool: 'rgb(var(--divider-cool) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-blue) / <alpha-value>)',
          hover: 'rgb(var(--brand-blue-hover) / <alpha-value>)',
          aa: 'rgb(var(--brand-blue-aa) / <alpha-value>)',
          soft: 'rgb(var(--brand-blue-soft) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          on: 'rgb(var(--ink-on) / <alpha-value>)',
        },
        accent: {
          warm1: 'rgb(var(--accent-warm-1) / <alpha-value>)',
          warm2: 'rgb(var(--accent-warm-2) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: '0 2px 12px rgba(17, 24, 39, 0.06)',
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.bg-accent-warm': {
          backgroundImage:
            'linear-gradient(135deg, rgb(var(--accent-warm-1)) 0%, rgb(var(--accent-warm-2)) 100%)',
        },
      });

      addUtilities({
        '.bg-app': { backgroundColor: 'rgb(var(--bg-default) / 1)' },
        '.bg-surface': { backgroundColor: 'rgb(var(--surface) / 1)' },
        '.text-primary': { color: 'rgb(var(--text-primary) / 1)' },
        '.text-secondary': { color: 'rgb(var(--text-secondary) / 1)' },
        '.text-tertiary': { color: 'rgb(var(--text-tertiary) / 1)' },
        '.border-divider': { borderColor: 'rgb(var(--divider) / 1)' },
        '.border-divider-cool': { borderColor: 'rgb(var(--divider-cool) / 1)' },
      });
    }),
  ],
};
