import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#22d3ee',
        dark: '#0f172a',
      },
    },
  },
  plugins: [],
};
export default config;
