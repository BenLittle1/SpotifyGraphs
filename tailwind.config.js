/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neon-pink': '#FF10F0',
        'neon-blue': '#00FFF0',
        'neon-green': '#39FF14',
        'neon-yellow': '#FFFF00',
        'neon-orange': '#FF6600',
        'neon-purple': '#BF00FF',
        'neon-cyan': '#00FFFF',
        'dark-bg': '#000000',
        'dark-surface': '#0A0A0A',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          'from': {
            'box-shadow': '0 0 10px -10px currentColor',
          },
          'to': {
            'box-shadow': '0 0 20px 10px currentColor',
          },
        },
      },
    },
  },
  plugins: [],
} 