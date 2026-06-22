/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: '#FBFBFA',
        ink: '#121A14',
        muted: '#626C65',
        forest: '#1B4324',
        sage: '#EAF2EB',
        border: '#EAEAEA',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Newsreader"', '"Lora"', 'serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}