/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4ff",
          100: "#e0eaff",
          200: "#c0d5ff",
          300: "#91b4ff",
          400: "#5b8bff",
          500: "#2d63f5",
          600: "#1748eb",
          700: "#1238d8",
          800: "#152eaf",
          900: "#0F2D5E",
          950: "#0a1d3f",
        },
        brand: {
          blue: "#1E6FFF",
          navy: "#0F2D5E",
          light: "#EEF4FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
