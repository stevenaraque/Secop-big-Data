/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // Tema por clase .dark en <html> (toggle manual, persistido). Qué: dark: variants.
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
}

