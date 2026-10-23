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
        /*
         * Paleta do logo TDF: verde-água, âmbar, coral e azul-marinho.
         * Fixas (não tokenizadas) — são cores de identidade, não de tema.
         */
        teal: {
          DEFAULT: 'hsl(174 58% 39%)',
          300: 'hsl(174 58% 57%)',
          500: 'hsl(174 58% 47%)',
          700: 'hsl(174 58% 31%)',
        },
        amber: {
          DEFAULT: 'hsl(37 79% 50%)',
          dark: 'hsl(37 79% 42%)',
          light: 'hsl(37 79% 57%)',
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

        /*
         * Tokens semânticos. A paleta vive em src/index.css — trocar a
         * marca é editar os HSLs lá, não este arquivo.
         *
         * IMPORTANTE: cada cor aparece UMA vez aqui. Este arquivo declarava
         * `primary` duas vezes (verde-água e o cinza do shadcn); a segunda
         * sobrescrevia a primeira e nenhuma página mostrava a cor do logo.
         */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          dark: 'hsl(var(--primary-dark))',
          light: 'hsl(var(--primary-light))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
