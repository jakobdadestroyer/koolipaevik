/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const stone = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, v(`stone-${n}`)]));

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        stone,
        paper: v("paper"),
        card: v("card"),
        leaf: { DEFAULT: v("leaf"), line: v("leaf-line"), ink: v("leaf-ink"), deep: v("leaf-deep") },
        pool: { DEFAULT: v("pool"), line: v("pool-line") },
        blush: { DEFAULT: v("blush"), line: v("blush-line") },
        butter: { DEFAULT: v("butter"), line: v("butter-line") },
      },
    },
  },
  plugins: [],
};
