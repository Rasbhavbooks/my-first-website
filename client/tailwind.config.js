/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#242424",
        paper: "#F6F3EE",
        gold: "#D6AE68",
        "gold-dark": "#B08A45",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
