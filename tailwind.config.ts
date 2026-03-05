import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#d9e4f0',
          200: '#b3c9e1',
          300: '#8daed2',
          400: '#6793c3',
          500: '#4178b4',
          600: '#2E6DA4',
          700: '#1E3A5F',
          800: '#162d4a',
          900: '#0e1f35',
        },
        amber: {
          400: '#F59E0B',
          500: '#E8A020',
          600: '#D97706',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['DM Sans', 'Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
