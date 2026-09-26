import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/blog",
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    author: z.string().default("Sergio Flores"),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    published: z.boolean().default(true),
    accent: z.string().optional(),
  }),
});

export const collections = { blog };
