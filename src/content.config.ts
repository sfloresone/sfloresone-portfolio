import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/blog",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    author: z.string().default("Sergio Flores"),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const project = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/project",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()),
    summary: z.string(),
    year: z.number(),
    color: z.string(),
    blogSlug: z.string(),
    author: z.string().default("Sergio Flores"),
    description: z.string().optional(),
  }),
});

export const collections = { blog, project };
