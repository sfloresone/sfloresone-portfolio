export interface Project {
  title: string;
  tags: string[];
  summary: string;
  projectHref: string;
  blogHref?: string;
  liveHref?: string;
  githubHref: string;
}

export const featuredProjects: Project[] = [
  {
    title: "PulseFi",
    tags: ["Astro", "React", "Convex", "Python"],
    summary: "Public financial visualization — interactive charts, IPO calendar, and market news. Read-only MVP with Astro, React, and Convex.",
    projectHref: "https://github.com/sfloresone/pulsefi",
    githubHref: "https://github.com/sfloresone/pulsefi",
  },
  {
    title: "42-cursus",
    tags: ["C", "Python", "Makefile"],
    summary: "Peer-to-peer, gamified learning through real technical challenges. The repository with every project I build at 42 Madrid.",
    projectHref: "https://github.com/sfloresone/42-cursus",
    githubHref: "https://github.com/sfloresone/42-cursus",
  },
  {
    title: "a_maze_ing",
    tags: ["Python", "Algorithms", "Data Structures"],
    summary: "Maze generator and solver library implemented in Python exposing a simple API.",
    projectHref: "/blog/a_maze_ing",
    blogHref: "/blog/a_maze_ing",
    githubHref: "https://github.com/sfloresone/a_maze_ing",
  },
  {
    title: "Forahome",
    tags: ["Java", "Astro", "PostgreSQL", "Docker"],
    summary: "Higher Degree final project. A platform to request home services: plumbers, electricians, etc... in a simple and direct way.",
    projectHref: "https://github.com/talechto/forahome-backend",
    liveHref: "https://forahome.one",
    githubHref: "https://github.com/talechto/forahome-web-client",
  },
];
