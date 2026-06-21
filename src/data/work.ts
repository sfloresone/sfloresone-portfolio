export interface Role {
  title: string;
  type: string;
  period: string;
  bullets: string[];
  current?: boolean;
}

export interface WorkEntry {
  company: string;
  logo: string;
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
        title: "Junior Software Engineer",
        type: "Full-time",
        period: "Jul. 2026 – Present",
        current: true,
        bullets: [
          "Building production-grade AI products integrated into enterprise software distribution workflows.",
          "Designing backend architecture and APIs for internal tooling.",
        ],
      },
      {
        title: "Software Developer Intern",
        type: "Internship",
        period: "Feb. 2026 – Jun. 2026",
        bullets: [
          "Led the end-to-end development of the corporate document intranet, from initial design through production deployment.",
          "Developed the backend using Hono and SQLite, consumed by and interface built with Astro and Svelte.",
          "Designed a lightweight Markdown-based RAG engine to augment a new internal AI's knowledge base.",
        ],
      },
    ],
  },
  {
    company: "Talechto",
    logo: "/favicon-talechto.png",
    url: "https://talechto.com",
    location: "Madrid, Spain",
    totalPeriod: "2026 – Present",
    tags: ["Python", "Django", "PostgreSQL"],
    roles: [
      {
        title: "Freelance Full Stack Developer",
        type: "Freelance",
        period: "Jun. 2026 – Present",
        bullets: [
          "Developed and maintained the backend API for the company's main product.",
          "Implemented database schemas and optimized queries for performance.",
        ],
      },
    ],
  }
];
