export type Link = {
  label: string;
  href: string;
};

export type EducationEntry = {
  abbreviation: string;
  bullets: string[];
  educationType: string;
  institution: string;
  logo: string;
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
  bullets: string[];
  tags: string[];
  current?: boolean;
};

export type WorkEntry = {
  company: string;
  url: string;
  logo: string;
  location: string;
  arrangement: WorkArrangement;
  roles: Role[];
};

export type Project = {
  title: string;
  tags: string[];
  summary: string;
  projectHref: string;
  blogHref?: string;
  liveHref?: string;
  githubHref: string;
};

export type SectionId = "about" | "work" | "blog";

export type Section = {
  id: SectionId;
  label: string;
  href: string;
  title: string;
  description: string;
};

export type BlogCategory = "Dev" | "Design" | "Life";

export type CategoryStyle = {
  bar: string;
  text: string;
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

  sections: [
    {
      id: "about",
      label: "About",
      href: "/about",
      title: "About — Sergio Flores",
      description:
        "Sergio Flores, software engineer. Background, education at 42 Madrid and the stack I work with.",
    },
    {
      id: "work",
      label: "Work",
      href: "/work",
      title: "Work — Sergio Flores",
      description: "Roles and selected projects: AI products at Zaltor, 42 Madrid coursework and more.",
    },
    {
      id: "blog",
      label: "Blog",
      href: "/blog",
      title: "Blog — Sergio Flores",
      description: "Notes on software engineering, design and life by Sergio Flores.",
    },
  ] satisfies Section[],

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
      logo: "/upm-logo.png",
      period: "In progress",
      educationType: "University · Computer Science",
      studyName: "Information Systems Engineering",
      bullets: [
        "Mathematics and data structures & algorithms",
        "Programming and software design in Java",
      ],
      tags: ["Software Engineering", "Maths", "DSA", "Java"],
    },
    {
      institution: "42 Madrid",
      abbreviation: "42",
      logo: "/42-logo.png",
      period: "Sept. 2025 – Present",
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
      logo: "/ies-tetuan.png",
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
      logo: "/zaltor-logo.png",
      location: "Spain",
      arrangement: "Remote",
      roles: [
        {
          title: "Junior Software Engineer",
          type: "Full-time",
          start: "2026-07",
          end: null,
          current: true,
          bullets: [
            "Building and shipping AI products for internal and public-facing use",
            "Product design across React and Astro interfaces, backend services, and deployment pipelines",
          ],
          tags: ["TypeScript", "React", "Astro", "Python", "Docker"],
        },
        {
          title: "Software Developer Intern",
          type: "Internship",
          start: "2026-02",
          end: "2026-06",
          bullets: [
            "Led end-to-end development of the corporate document intranet, from architecture through production",
            "Designed a Markdown-based RAG engine to keep the internal AI assistant current with company docs",
          ],
          tags: ["TypeScript", "Astro", "SQLite", "Bun", "Node.js"],
        },
      ],
    },
  ] satisfies WorkEntry[],

  featuredProjects: [
    {
      title: "PulseFi",
      tags: ["Astro", "React", "Convex", "Python"],
      summary:
        "A public, read-only market dashboard for exploring financial charts, upcoming IPOs, and market news.",
      projectHref: "https://github.com/sfloresone/pulsefi",
      githubHref: "https://github.com/sfloresone/pulsefi",
    },
    {
      title: "42-cursus",
      tags: ["C", "Python", "Makefile"],
      summary:
        "A collection of programming projects completed through 42 Madrid's peer-to-peer curriculum.",
      projectHref: "https://github.com/sfloresone/42-cursus",
      githubHref: "https://github.com/sfloresone/42-cursus",
    },
    {
      title: "a_maze_ing",
      tags: ["Python", "Algorithms", "Data Structures"],
      summary: "A Python library for generating mazes and finding the shortest route through them.",
      projectHref: "/blog/a_maze_ing",
      blogHref: "/blog/a_maze_ing",
      githubHref: "https://github.com/sfloresone/a_maze_ing",
    },
    {
      title: "Forahome",
      tags: ["Java", "Astro", "PostgreSQL", "Docker"],
      summary:
        "A home-services platform for requesting help from plumbers, electricians, and other local trades.",
      projectHref: "https://github.com/talechto/forahome-backend",
      liveHref: "https://forahome.one",
      githubHref: "https://github.com/talechto/forahome-web-client",
    },
  ] satisfies Project[],

  categoryStyles: {
    Dev: { bar: "#3b82f6", text: "#2563eb" },
    Design: { bar: "#ec4899", text: "#db2777" },
    Life: { bar: "#10b981", text: "#059669" },
  } as const satisfies { [K in BlogCategory]: CategoryStyle },

  defaultCategoryStyle: {
    bar: "#000",
    text: "#000",
  } satisfies CategoryStyle,
};

export const {
  intro,
  sections,
  socials,
  education,
  skills,
  workExperiences,
  featuredProjects,
  categoryStyles,
  defaultCategoryStyle,
} = site;

export function sectionById(id: SectionId): Section {
  const section = sections.find((entry) => entry.id === id);

  if (!section) throw new Error(`Unknown section: ${id}`);

  return section;
}

export function styleForCategory(category: string): CategoryStyle {
  if (category === "Dev" || category === "Design" || category === "Life") {
    return categoryStyles[category];
  }

  return defaultCategoryStyle;
}
