import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        ink: {
          950: '#0c1220',
          900: '#111a2e',
          800: '#182238'
        }
      }
    }
  },
  plugins: []
};

export default config;
