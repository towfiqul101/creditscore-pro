/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#39FF14",
          dark: "#0FAF3C",
          light: "#7CFF4F",
          50: "#F0FFF0",
          900: "#001A00",
        },
        surface: {
          DEFAULT: "#080C08",
          light: "#101810",
          card: "#0A0F0A",
        },
        border: {
          DEFAULT: "#162016",
          light: "#1E2E1E",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
