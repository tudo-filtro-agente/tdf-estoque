/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores TDF (logo)
        primary: {
          DEFAULT: 'hsl(174 58% 47%)', // verde-água
          dark: 'hsl(174 58% 37%)',
          light: 'hsl(174 58% 57%)',
        },
        amber: {
          DEFAULT: 'hsl(37 79% 57%)',
          dark: 'hsl(37 79% 47%)',
        },
        coral: {
          DEFAULT: 'hsl(11 60% 58%)',
          dark: 'hsl(11 60% 48%)',
        },
        navy: {
          DEFAULT: 'hsl(213 64% 33%)',
          dark: 'hsl(213 64% 23%)',
          light: 'hsl(213 64% 43%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
