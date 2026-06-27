export interface EducationEntry {
  comment: string;
  institution: string;
  period: string;
  note: string;
}

export const education: EducationEntry[] = [
  {
    comment: "42 Madrid - Fundación Telefónica",
    institution: "Advanced Software Engineering Fellowship",
    period: "Sept. 2025 – Present",
    note: "Peer-to-peer methodology. No lectures, no teachers — learning through projects and collaboration.",
  },
  {
    comment: "IES Tetuán de las Victorias",
    institution: "Associate’s in Software Engineering and Web Development",
    period: "Sept. 2024 – Jun. 2026",
    note: "Cloud Computing foundations and web infrastructure deployment using AWS (EC2, S3, IAM)",
  },
];

export const skills = {
  languages:  ["Java", "Python", "C", "TypeScript", "JavaScript", "SQL"],
  databases:  ["PostgreSQL", "MySQL", "SQLite"],
  frameworks: ["Spring Boot", "Astro", "Node.js", "Bun", "React"],
  tools:      ["Git", "Makefile", "Docker", "Linux", "IntelliJ IDEA", "VSCode"],
};
