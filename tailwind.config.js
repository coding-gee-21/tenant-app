/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: "#09090B",
        surface: "#121214",
        card: "#18181B",
        border: "rgba(255, 255, 255, 0.1)",
      },
    },
  },
  plugins: [],
};
