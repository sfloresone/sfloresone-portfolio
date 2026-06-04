// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
  },
  fonts: [
    {
      name: "Libre Baskerville",
      cssVariable: "--font-libre-baskerville",
      provider: fontProviders.fontsource(),
      weights: [400, 700],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
    {
      name: "Manrope",
      cssVariable: "--font-manrope",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
});