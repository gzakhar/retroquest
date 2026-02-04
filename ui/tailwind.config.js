/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "retro-green": "#10B981",
        "retro-yellow": "#FBBF24",
        "retro-red": "#EF4444",
        "retro-blue": "#3B82F6",
        "retro-purple": "#8B5CF6",
      },
    },
  },
  plugins: [],
};
