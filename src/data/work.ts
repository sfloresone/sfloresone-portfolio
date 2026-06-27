import type { ImageMetadata } from 'astro';
import talechtoLogo from '../assets/logos/talechto.png';

export interface Role {
  title: string;
  type: string;
  period: string;
  description: string;
  current?: boolean;
}

export interface WorkEntry {
  company: string;
  logo: string | ImageMetadata;
  url: string;
  location: string;
  totalPeriod: string;
  tags?: string[];
  roles: Role[];
}

export const workExperiences: WorkEntry[] = [
  {
    company: "Zaltor",
    logo: "/logo-recortado.svg",
    url: "https://zaltor.com",
    location: "Madrid, Spain",
    totalPeriod: "2026 – Present",
    tags: ["OpenAI Platform", "Backend", "Enterprise Software", "Hono", "SQLite", "Astro", "Svelte"],
    roles: [
      {
        title: "/Junior Software Engineer",
        type: "Full-time",
        period: "Jul. 2026 – Present",
        current: true,
        description: `Following the internship, continued at Zaltor full-time to take the work further. Leading the <strong>development, design, and deployment</strong> of multiple AI products: some internal, some public-facing. The stack spans <strong>React and Astro</strong> on the frontend, paired with backend services and <strong>deployment pipelines</strong>. Still shipping features, maintaining production systems, and iterating fast — all while keeping the architecture clean and reliable.`,
      },
      {
        title: "/Software Developer Intern",
        type: "Internship",
        period: "Feb. 2026 – Jun. 2026",
        description: `Led the <strong>end-to-end development</strong> of the company's corporate document intranet — from initial design and architecture decisions through production deployment. Built the backend with <strong>Hono and SQLite</strong>, and the frontend interface with Astro and Svelte, keeping the stack lightweight. Also designed a <strong>Markdown-based RAG engine</strong> from scratch to give the company's internal AI assistant, up-to-date knowledge about internal documentation.`,
      },
    ],
  },
  {
    company: "Talechto",
    logo: talechtoLogo,
    url: "https://talechto.com",
    location: "Madrid, Spain",
    totalPeriod: "2026 – Present",
    tags: [],
    roles: [
      {
        title: "/Freelance Full Stack Developer",
        type: "Freelance",
        period: "Jun. 2026 – Present",
        description: `Talechto is my <strong>freelance brand</strong> —
         the name I use to take on independent work outside of full-time employment.
         Currently engaged on a project helping extend an existing product features through
         <strong>new integrations</strong>, operating as the
        sole person responsible for scoping, implementation, and delivery.`
      },
    ],
  },
];
