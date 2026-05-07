import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vivo: {
          DEFAULT: "#14b8a6",
          dark: "#0f766e",
          light: "#5eead4",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "Apple Color Emoji", "Segoe UI Emoji"],
      },
      boxShadow: {
        soft: "0 10px 40px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
