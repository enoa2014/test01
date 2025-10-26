import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,vue,svelte,mdx,wxml,wxss}',
  ],
  theme: {
    extend: {
      colors: {
        /* Surfaces / Neutrals */
        'bg-default': 'rgb(var(--bg-default) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        divider: 'rgb(var(--divider) / <alpha-value>)',

        /* Text */
        ink: {
          DEFAULT: 'rgb(var(--ink-900) / <alpha-value>)', // 主文
          soft: 'rgb(var(--ink-700) / <alpha-value>)', // 次文
          faint: 'rgb(var(--ink-500) / <alpha-value>)', // 说明/占位
          on: 'rgb(var(--on-dark) / <alpha-value>)', // 深色背景上的文字
        },

        /* Brand - 疗愈青绿 */
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)', // 线框/链接
          600: 'rgb(var(--brand-600) / <alpha-value>)', // 悬停
          700: 'rgb(var(--brand-700) / <alpha-value>)', // 主要按钮/主导航
        },

        /* Accent - 日出桃(关怀/强调) */
        peach: {
          100: 'rgb(var(--peach-100) / <alpha-value>)',
          300: 'rgb(var(--peach-300) / <alpha-value>)',
          500: 'rgb(var(--peach-500) / <alpha-value>)',
          600: 'rgb(var(--peach-600) / <alpha-value>)',
        },

        /* Accent 别名 - Ecru（与 peach 等价，更语义化） */
        ecru: {
          100: 'rgb(var(--peach-100) / <alpha-value>)',
          300: 'rgb(var(--peach-300) / <alpha-value>)',
          500: 'rgb(var(--peach-500) / <alpha-value>)',
          600: 'rgb(var(--peach-600) / <alpha-value>)',
        },

        /* Accent 别名 - Lilac（Calm-Sky 中的薰衣草点缀） */
        lilac: {
          100: 'rgb(var(--peach-100) / <alpha-value>)',
          300: 'rgb(var(--peach-300) / <alpha-value>)',
          500: 'rgb(var(--peach-500) / <alpha-value>)',
          600: 'rgb(var(--peach-600) / <alpha-value>)',
        },

        /* 状态色 */
        info: {
          100: 'rgb(var(--info-100) / <alpha-value>)',
          600: 'rgb(var(--info-600) / <alpha-value>)',
        },
        success: {
          100: 'rgb(var(--success-100) / <alpha-value>)',
          600: 'rgb(var(--success-600) / <alpha-value>)',
        },
        warning: {
          100: 'rgb(var(--warning-100) / <alpha-value>)',
          600: 'rgb(var(--warning-600) / <alpha-value>)',
        },
        danger: {
          100: 'rgb(var(--danger-100) / <alpha-value>)',
          600: 'rgb(var(--danger-600) / <alpha-value>)',
        },
      },

      borderRadius: {
        card: '16rpx', /* 小程序里也可用 px */
        pill: '9999px',
      },
      boxShadow: {
        card: '0 8px 24px rgba(17, 24, 39, 0.06)',
      },
    },
  },

  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        /* 语义捷径 */
        '.bg-app': { backgroundColor: 'rgb(var(--bg-default) / 1)' },
        '.bg-surface': { backgroundColor: 'rgb(var(--surface) / 1)' },
        '.bg-surface-muted': { backgroundColor: 'rgb(var(--surface-muted) / 1)' },

        '.text-primary': { color: 'rgb(var(--ink-900) / 1)' },
        '.text-secondary': { color: 'rgb(var(--ink-700) / 1)' },
        '.text-tertiary': { color: 'rgb(var(--ink-500) / 1)' },

        '.border-divider': { borderColor: 'rgb(var(--divider) / 1)' },

        /* 品牌渐变：青绿→桃色，用于徽标/进度条/空状态插画 */
        '.bg-brand-peach': {
          backgroundImage:
            'linear-gradient(135deg, rgb(var(--brand-600)) 0%, rgb(var(--peach-500)) 100%)',
        },
      });
    }),
  ],
};

export default config;
