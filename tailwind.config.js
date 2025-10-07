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
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        divider: {
          DEFAULT: 'rgb(var(--divider) / <alpha-value>)',
          cool: 'rgb(var(--divider-cool) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-900, var(--ink)) / <alpha-value>)',
          soft: 'rgb(var(--ink-700, var(--text-secondary)) / <alpha-value>)',
          faint: 'rgb(var(--ink-500, var(--text-tertiary)) / <alpha-value>)',
          on: 'rgb(var(--on-dark, var(--ink-on)) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--brand-50, var(--brand-blue-soft)) / <alpha-value>)',
          100: 'rgb(var(--brand-100, var(--brand-blue-soft)) / <alpha-value>)',
          300: 'rgb(var(--brand-300, var(--brand-blue-soft)) / <alpha-value>)',
          500: 'rgb(var(--brand-500, var(--brand-blue)) / <alpha-value>)',
          600: 'rgb(var(--brand-600, var(--brand-blue-hover)) / <alpha-value>)',
          700: 'rgb(var(--brand-700, var(--brand-blue-aa)) / <alpha-value>)',
          DEFAULT: 'rgb(var(--brand-500, var(--brand-blue)) / <alpha-value>)',
          hover: 'rgb(var(--brand-600, var(--brand-blue-hover)) / <alpha-value>)',
          aa: 'rgb(var(--brand-700, var(--brand-blue-aa)) / <alpha-value>)',
          soft: 'rgb(var(--brand-300, var(--brand-blue-soft)) / <alpha-value>)',
        },
        peach: {
          100: 'rgb(var(--peach-100, var(--accent-warm-2)) / <alpha-value>)',
          300: 'rgb(var(--peach-300, var(--accent-warm-1)) / <alpha-value>)',
          500: 'rgb(var(--peach-500, var(--accent-warm-1)) / <alpha-value>)',
          600: 'rgb(var(--peach-600, var(--accent-warm-2)) / <alpha-value>)',
        },
        info: {
          100: 'rgb(var(--info-100, var(--brand-blue-soft)) / <alpha-value>)',
          600: 'rgb(var(--info-600, var(--brand-blue-aa)) / <alpha-value>)',
        },
        success: {
          100: 'rgb(var(--success-100, 210 240 224) / <alpha-value>)',
          600: 'rgb(var(--success-600, 39 174 96) / <alpha-value>)',
        },
        warning: {
          100: 'rgb(var(--warning-100, 255 243 213) / <alpha-value>)',
          600: 'rgb(var(--warning-600, 197 126 20) / <alpha-value>)',
        },
        danger: {
          100: 'rgb(var(--danger-100, 255 225 225) / <alpha-value>)',
          600: 'rgb(var(--danger-600, 214 69 69) / <alpha-value>)',
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
        '.bg-brand-peach': {
          backgroundImage:
            'linear-gradient(135deg, rgb(var(--brand-600, var(--accent-warm-1))) 0%, rgb(var(--peach-500, var(--accent-warm-2))) 100%)',
        },
      });

      addUtilities({
        '.bg-app': { backgroundColor: 'rgb(var(--bg-default) / 1)' },
        '.bg-surface': { backgroundColor: 'rgb(var(--surface) / 1)' },
        '.bg-surface-muted': { backgroundColor: 'rgb(var(--surface-muted) / 1)' },
        '.text-primary': { color: 'rgb(var(--text-primary) / 1)' },
        '.text-secondary': { color: 'rgb(var(--text-secondary) / 1)' },
        '.text-tertiary': { color: 'rgb(var(--text-tertiary) / 1)' },
        '.border-divider': { borderColor: 'rgb(var(--divider) / 1)' },
        '.border-divider-cool': { borderColor: 'rgb(var(--divider-cool) / 1)' },
      });
    }),
  ],
};
