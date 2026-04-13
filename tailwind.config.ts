import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        aurora: {
          bg: '#F8F9FB',
          surface: '#FFFFFF',
          elevated: '#F2F5FA',
          overlay: '#E8EEF8',
          border: '#D7DEEA',
          'border-light': '#C4CFDF',

          chrome: '#1F2A44',
          'chrome-soft': '#283756',
          'chrome-border': '#324567',
          'chrome-text': '#F8FAFC',
          'chrome-muted': '#CBD5E1',

          primary: '#3730A3',
          'primary-hover': '#312E81',
          'primary-muted': '#E6E8FF',
          'primary-glow': '#3730A320',
          'primary-light': '#4F46E5',
          'primary-pale': '#EEF2FF',

          green: '#15803D',
          'green-hover': '#166534',
          'green-muted': '#DCFCE7',
          'green-pale': '#F0FDF4',

          amber: '#B45309',
          'amber-hover': '#92400E',
          'amber-muted': '#FEF3C7',
          'amber-pale': '#FFF7ED',

          red: '#C2410C',
          'red-muted': '#FEE2E2',
          'red-pale': '#FFF1F2',

          blue: '#1D4ED8',
          'blue-pale': '#DBEAFE',

          'text-primary': '#0F172A',
          'text-secondary': '#334155',
          'text-muted': '#64748B',
          'text-inverse': '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '18px' }],
        base:  ['14px', { lineHeight: '20px' }],
        md:    ['15px', { lineHeight: '22px' }],
        lg:    ['16px', { lineHeight: '24px' }],
        xl:    ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
      },
      borderRadius: {
        sm:   '6px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl':'20px',
        pill: '9999px',
      },
      boxShadow: {
        'aurora-sm': '0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(148, 163, 184, 0.08)',
        'aurora-md': '0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.1)',
        'aurora-lg': '0 20px 48px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.12)',
        'glow-purple': '0 12px 30px rgba(55, 48, 163, 0.18)',
        'glow-green': '0 12px 30px rgba(21, 128, 61, 0.16)',
        'glow-amber': '0 12px 30px rgba(180, 83, 9, 0.16)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-critical': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'drag-over': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.02)' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.22s ease-out',
        'slide-up':       'slide-up 0.2s ease-out',
        'scale-in':       'scale-in 0.18s ease-out',
        'pulse-critical': 'pulse-critical 1.8s ease-in-out infinite',
        shimmer:          'shimmer 2s linear infinite',
        'drag-over':      'drag-over 0.6s ease-in-out infinite',
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(135deg, #EEF2FF 0%, transparent 62%)',
        'green-gradient': 'linear-gradient(135deg, #DCFCE7 0%, transparent 62%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(55, 48, 163, 0.08) 50%, transparent 100%)',
        'topbar-gradient': 'linear-gradient(180deg, #1F2A44 0%, #243250F2 100%)',
        'card-gradient': 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config
