export interface Project {
  title: string;
  tags: string[];
  summary: string;
  projectHref: string;
  blogHref: string;
  liveHref?: string;
  githubHref: string;
}

export const featuredProjects: Project[] = [
  {
    title: "sflores.one",
    tags: ["Astro", "Tailwind", "Cloudflare"],
    summary: "My personal space on the web. This very portfolio, built with Astro and Tailwind, deployed on Cloudflare.",
    projectHref: "/project/sflores-one",
    blogHref: "/blog/test-post",
    liveHref: "https://sflores.one",
    githubHref: "https://github.com/sfloresone/sfloresone-portfolio",
  },
  {
    title: "42-cursus",
    tags: ["C", "Python", "Makefile"],
    summary: "Peer-to-peer, gamified learning through real technical challenges. The repository with every project I build at 42 Madrid.",
    projectHref: "https://github.com/sfloresone/42-cursus",
    blogHref: "/blog/42-cursus",
    githubHref: "https://github.com/sfloresone/42-cursus",
  },
  {
    title: "a_maze_ing",
    tags: ["Python", "Algorithms", "Data Structures"],
    summary: "Maze generator and solver library implemented in Python exposing a simple API.",
    projectHref: "#",
    blogHref: "/blog/a_maze_ing",
    githubHref: "https://github.com/sfloresone/a_maze_ing",
  },
  {
    title: "Forahome",
    tags: ["Java", "Astro", "PostgreSQL", "Docker"],
    summary: "App iOS para procesamiento de imagen en tiempo real con modelos CoreML on-device. Sin latencia de red.",
    projectHref: "#",
    blogHref: "/blog/forahome",
    liveHref: "https://forahome.one",
    githubHref: "https://github.com/talechto/forahome-web-client",
  },
];
