import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Dynamic adaptive palettes for Seamless Light & Dark Modes
        slate: {
          50: "rgb(var(--color-slate-50) / <alpha-value>)",
          100: "rgb(var(--color-slate-100) / <alpha-value>)",
          200: "rgb(var(--color-slate-200) / <alpha-value>)",
          300: "rgb(var(--color-slate-300) / <alpha-value>)",
          400: "rgb(var(--color-slate-400) / <alpha-value>)",
          500: "rgb(var(--color-slate-500) / <alpha-value>)",
          600: "rgb(var(--color-slate-600) / <alpha-value>)",
          700: "rgb(var(--color-slate-700) / <alpha-value>)",
          750: "rgb(var(--color-slate-750) / <alpha-value>)",
          800: "rgb(var(--color-slate-800) / <alpha-value>)",
          850: "rgb(var(--color-slate-850) / <alpha-value>)",
          900: "rgb(var(--color-slate-900) / <alpha-value>)",
          950: "rgb(var(--color-slate-950) / <alpha-value>)",
        },
        emerald: {
          50: "rgb(var(--color-emerald-50) / <alpha-value>)",
          100: "rgb(var(--color-emerald-100) / <alpha-value>)",
          200: "rgb(var(--color-emerald-200) / <alpha-value>)",
          300: "rgb(var(--color-emerald-300) / <alpha-value>)",
          400: "rgb(var(--color-emerald-400) / <alpha-value>)",
          500: "rgb(var(--color-emerald-500) / <alpha-value>)",
          600: "rgb(var(--color-emerald-600) / <alpha-value>)",
          700: "rgb(var(--color-emerald-700) / <alpha-value>)",
          800: "rgb(var(--color-emerald-800) / <alpha-value>)",
          900: "rgb(var(--color-emerald-900) / <alpha-value>)",
          950: "rgb(var(--color-emerald-950) / <alpha-value>)",
        },
        cyan: {
          50: "rgb(var(--color-cyan-50) / <alpha-value>)",
          100: "rgb(var(--color-cyan-100) / <alpha-value>)",
          200: "rgb(var(--color-cyan-200) / <alpha-value>)",
          300: "rgb(var(--color-cyan-300) / <alpha-value>)",
          400: "rgb(var(--color-cyan-400) / <alpha-value>)",
          500: "rgb(var(--color-cyan-500) / <alpha-value>)",
          600: "rgb(var(--color-cyan-600) / <alpha-value>)",
          700: "rgb(var(--color-cyan-700) / <alpha-value>)",
          800: "rgb(var(--color-cyan-800) / <alpha-value>)",
          900: "rgb(var(--color-cyan-900) / <alpha-value>)",
          950: "rgb(var(--color-cyan-950) / <alpha-value>)",
        },
        amber: {
          50: "rgb(var(--color-amber-50) / <alpha-value>)",
          100: "rgb(var(--color-amber-100) / <alpha-value>)",
          200: "rgb(var(--color-amber-200) / <alpha-value>)",
          300: "rgb(var(--color-amber-300) / <alpha-value>)",
          400: "rgb(var(--color-amber-400) / <alpha-value>)",
          500: "rgb(var(--color-amber-500) / <alpha-value>)",
          600: "rgb(var(--color-amber-600) / <alpha-value>)",
          700: "rgb(var(--color-amber-700) / <alpha-value>)",
          800: "rgb(var(--color-amber-800) / <alpha-value>)",
          900: "rgb(var(--color-amber-900) / <alpha-value>)",
          950: "rgb(var(--color-amber-950) / <alpha-value>)",
        },
        rose: {
          50: "rgb(var(--color-rose-50) / <alpha-value>)",
          100: "rgb(var(--color-rose-100) / <alpha-value>)",
          200: "rgb(var(--color-rose-200) / <alpha-value>)",
          300: "rgb(var(--color-rose-300) / <alpha-value>)",
          400: "rgb(var(--color-rose-400) / <alpha-value>)",
          500: "rgb(var(--color-rose-500) / <alpha-value>)",
          600: "rgb(var(--color-rose-600) / <alpha-value>)",
          700: "rgb(var(--color-rose-700) / <alpha-value>)",
          800: "rgb(var(--color-rose-800) / <alpha-value>)",
          900: "rgb(var(--color-rose-900) / <alpha-value>)",
          950: "rgb(var(--color-rose-950) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
