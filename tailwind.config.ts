import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          500: '#1d6fb8',
          600: '#155a97',
          700: '#114777',
        },
      },
    },
  },
  plugins: [],
};

export default config;
