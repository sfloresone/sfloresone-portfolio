// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";

export default defineConfig({
  site: "https://sflores.one",
  integrations: [mdx()],

  prefetch: {
    defaultStrategy: "hover",
  },

  vite: {
    plugins: [tailwindcss(), wgslVitePlugin({ minify: true })],
  },

  fonts: [
    {
      name: "Neue Montreal",
      cssVariable: "--font-neue-montreal",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: 300,
            style: "normal",
            src: ["./src/assets/fonts/neue-montreal/neuemontreal-light.otf"],
          },
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/neue-montreal/neuemontreal-regular.otf"],
          },
          {
            weight: 400,
            style: "italic",
            src: ["./src/assets/fonts/neue-montreal/neuemontreal-italic.otf"],
          },
          {
            weight: 500,
            style: "normal",
            src: ["./src/assets/fonts/neue-montreal/neuemontreal-medium.otf"],
          },
          {
            weight: 700,
            style: "normal",
            src: ["./src/assets/fonts/neue-montreal/neuemontreal-bold.otf"],
          },
        ],
      },
    },
    {
      name: "Space Grotesk",
      cssVariable: "--font-space-grotesk",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
});
