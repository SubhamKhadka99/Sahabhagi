/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:   "#0A192F",
          navy2:  "#122A4D",
          cyan:   "#00B4D8",
          cyan2:  "#0EA5C4",
          amber:  "#D97706",
          teal:   "#0D7C66",
          green:  "#1E8F5F",
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out forwards",
        "slide-up": "slide-up 0.25s cubic-bezier(0.16,1,0.3,1) forwards",
        "scale-in": "scale-in 0.15s ease-out forwards",
        "slide-in-left": "slide-in-left 0.22s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateX(-50%) translateY(-8px)" },
          to:   { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
