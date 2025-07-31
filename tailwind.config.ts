import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
    theme: {
    extend: {
      colors: {
        'bfe-orange-light': '#FFB257',
        'bfe-orange':       '#EC6921',
        'bfe-green-light':  '#84C85A',
        'bfe-green':        '#63B338',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        inter:      ['Inter',      'sans-serif'],
      },
    },
  },
  plugins: [],
};



export default config;
