// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Roundo",
      cssVariable: "--font-roundo",
      provider: fontProviders.fontshare(),
      weights: [400, 500, 700],
      styles: ["normal"],
    },
    {
      name: "Lora",
      cssVariable: "--font-lora",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600, 700],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
  ],
});