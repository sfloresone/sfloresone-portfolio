import type { ImageMetadata } from "astro";
import { fieldDrawings } from "./drawings";
import { sections, story } from "./routes";
import iesLogo from "../assets/logos/ies-tetuan.png";
import fortyTwoLogo from "../assets/logos/42-logo.png";
import upmLogo from "../assets/logos/upm-logo.png";
import zaltorLogo from "../assets/logos/zaltor-logo.png";
import ambarBanner from "../assets/projects/ambar-banner.jpg";
import forahomeBanner from "../assets/projects/forahome-banner-portfolio.png";
import pulsefiBanner from "../assets/projects/pulsefi-banner.png";
import fortyTwoBanner from "../assets/projects/sf-header-42madrid.png";

/** An optimized asset, or a URL in `public/` for SVGs that need no processing. */
export type ImageSource = ImageMetadata | string;

export type Link = {
  label: string;
  href: string;
};

export type EducationEntry = {
  abbreviation: string;
  bullets: string[];
  educationType: string;
  institution: string;
  logo: ImageSource;
  period: string;
  studyName: string;
  tags: string[];
};

export type WorkArrangement = "Remote" | "On-site" | "Hybrid";

export type Role = {
  title: string;
  type: string;
  /** Inclusive start month as `YYYY-MM`. */
  start: `${number}-${number}`;
  /** Inclusive end month as `YYYY-MM`, or `null` for Present. */
  end: `${number}-${number}` | null;
  /** Paragraphs shown verbatim, as written on LinkedIn. */
  description: string[];
  tags: string[];
  current?: boolean;
};

export type WorkEntry = {
  company: string;
  /** Without it the company name renders as plain text. */
  url?: string;
  /** Without it the header falls back to a generic icon. */
  logo?: ImageSource;
  /** Image the dot field draws while this entry is being read. */
  drawing?: string;
  location: string;
  arrangement: WorkArrangement;
  roles: Role[];
};

export type Project = {
  title: string;
  banner?: { src: ImageMetadata; alt: string };
  /** Image the dot field draws while this entry is being read. */
  drawing?: string;
  tags: string[];
  summary: string;
  projectHref: string;
  liveHref?: string;
  githubHref: string;
};

export type Skills = {
  languages: string[];
  frontend: string[];
  backendData: string[];
  workflowAi: string[];
  platform: string[];
};

export const site = {
  name: "Sergio Flores",
  title: "Sergio Flores",
  description: "Personal portfolio",

  intro: "Software engineer building production-grade AI products at Zaltor.",

  sections,

  story,

  socials: [
    { label: "X", href: "https://x.com/sfloresone" },
    { label: "Github", href: "https://github.com/sfloresone" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/sergiofloresmr" },
    { label: "Email", href: "mailto:hello@sflores.one" },
  ] satisfies Link[],

  education: [
    {
      institution: "Universidad Politécnica de Madrid",
      abbreviation: "UPM",
      logo: upmLogo,
      period: "In progress",
      educationType: "Bachelor's Deg. · Software Engineering",
      studyName: "Software Engineering",
      bullets: [
        "Mathematics and data structures & algorithms",
        "Programming and software design in Java",
      ],
      tags: ["Software Engineering", "Maths", "DSA", "Java"],
    },
    {
      institution: "42 Madrid",
      abbreviation: "42",
      logo: fortyTwoLogo,
      period: "Sept. 2025 – Oct. 2026",
      educationType: "Fellowship · Software Engineering",
      studyName: "Advanced Software Engineering",
      bullets: [
        "Peer-to-peer learning through collaborative projects",
        "Hands-on practice without lectures or teachers",
      ],
      tags: ["Software Engineering", "Peer Learning", "Project-Based Learning"],
    },
    {
      institution: "IES Tetuán de las Victorias",
      abbreviation: "IES TV",
      logo: iesLogo,
      period: "Sept. 2024 – Jun. 2026",
      educationType: "Associate’s Degree",
      studyName: "Software Engineering and Web Development",
      bullets: [
        "Cloud computing foundations",
        "Web infrastructure deployment using AWS (EC2, S3, IAM)",
      ],
      tags: ["Software Engineering", "Web Development", "Cloud Computing", "AWS"],
    },
  ] satisfies EducationEntry[],

  skills: {
    languages: ["TypeScript", "JavaScript", "Python", "Java"],
    frontend: ["React", "Astro", "Tailwind", "Base UI", "shadcn"],
    backendData: ["Spring Boot", "Node.js", "Hono", "Bun", "PostgreSQL", "MySQL", "SQLite"],
    workflowAi: ["Cursor", "Claude Code", "Codex", "Gemini", "Pi", "Git", "GitHub"],
    platform: ["Docker", "Linux", "Cloudflare", "Vercel", "Supabase"],
  } satisfies Skills,

  workExperiences: [
    {
      company: "Zaltor",
      url: "https://zaltor.com",
      logo: zaltorLogo,
      drawing: fieldDrawings.zaltor,
      location: "Madrid, Spain",
      arrangement: "Hybrid",
      roles: [
        {
          title: "Junior Software Engineer",
          type: "Full-time",
          start: "2026-07",
          end: null,
          current: true,
          description: [
            "The platform moved forward and I stayed on to keep building it. I also own the development of the company's new public website.",
            "Deployed the platform to production and keep improving its RAG and LLM features.",
          ],
          tags: ["TypeScript", "React", "Docker", "Dokploy"],
        },
        {
          title: "Software Developer Intern",
          type: "Internship",
          start: "2026-02",
          end: "2026-06",
          description: [
            "The company wanted an internal platform for documentation and AI. I got to decide what to build and how, took it from its first version, to production.",
            "Built across the full stack with Bun, Hono, PostgreSQL, Astro and React, plus a RAG engine so our internal team could ask questions instead of searching through folders.",
          ],
          tags: ["Bun", "Hono", "PostgreSQL", "Astro", "React"],
        },
      ],
    },
    {
      company: "Independent",
      logo: "/sflores-logo-white.svg",
      location: "Madrid, Spain",
      arrangement: "Remote",
      roles: [
        {
          title: "Independent Software Engineer",
          type: "Self-employed",
          start: "2026-06",
          end: null,
          current: true,
          description: [
            "Building products and taking on projects for startups when they fit alongside my job.",
            'For <a href="https://planfactura.com" target="_blank" rel="noopener noreferrer">PlanFactura</a>, a startup building Verifactu-compliant invoicing, I integrated <a href="https://zertiban.com" target="_blank" rel="noopener noreferrer">Zertiban</a>\'s <a href="https://pagafactu.com" target="_blank" rel="noopener noreferrer">PagaFactu</a> payment API from sandbox to production, using Supabase, TypeScript, serverless functions and webhooks. I also refactored their landing page.',
          ],
          tags: ["TypeScript", "Supabase", "Payment APIs", "Webhooks"],
        },
      ],
    },
  ] satisfies WorkEntry[],

  featuredProjects: [
    {
      title: "Ambar",
      banner: { src: ambarBanner, alt: "" },
      drawing: fieldDrawings.ambar,
      tags: ["Astro", "React", "TypeScript", "Bun", "Golang"],
      summary: "Your mind, kept in sync. Private beta (via waitlist) coming soon.",
      projectHref: "https://github.com/sfloresone/ambar",
      liveHref: "https://ambar.page",
      githubHref: "https://github.com/sfloresone/ambar",
    },
    {
      title: "42-cursus",
      banner: { src: fortyTwoBanner, alt: "" },
      tags: ["C", "Python", "Makefile"],
      summary:
        "A collection of programming projects completed through 42 Madrid's peer-to-peer curriculum.",
      projectHref: "https://github.com/sfloresone/42-cursus",
      githubHref: "https://github.com/sfloresone/42-cursus",
    },
    {
      title: "PulseFi",
      banner: { src: pulsefiBanner, alt: "" },
      tags: ["Astro", "React", "Convex", "Python"],
      summary:
        "A public, read-only market dashboard for exploring financial charts, upcoming IPOs, and market news.",
      projectHref: "https://github.com/sfloresone/pulsefi",
      githubHref: "https://github.com/sfloresone/pulsefi",
    },
    {
      title: "Forahome",
      banner: { src: forahomeBanner, alt: "" },
      tags: ["Java", "Astro", "PostgreSQL", "Docker"],
      summary:
        "A home services platform for requesting help from plumbers, electricians, and other local trades. The drive is still there, due to legal reasons and lack of time, we've paused development for now.",
      projectHref: "https://github.com/talechto/forahome-backend",
      liveHref: "https://forahome.one",
      githubHref: "https://github.com/talechto/forahome-web-client",
    },
  ] satisfies Project[],
};

export const {
  intro,
  socials,
  education,
  skills,
  workExperiences,
  featuredProjects,
} = site;

export { sectionById, sections, shellPaths, story, type Section, type SectionId } from "./routes";
