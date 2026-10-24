/** Routes and section metadata: plain data, safe to import from client scripts. */

export type SectionId = "about" | "work" | "blog";

export type Section = {
  id: SectionId;
  label: string;
  href: string;
  title: string;
  description: string;
};

export const sections: Section[] = [
  {
    id: "about",
    label: "About",
    href: "/about",
    title: "About | Sergio Flores",
    description:
      "Sergio Flores, software engineer. Background, education and the stack I work with.",
  },
  {
    id: "work",
    label: "Work",
    href: "/work",
    title: "Work | Sergio Flores",
    description: "Roles and selected projects",
  },
  {
    id: "blog",
    label: "Blog",
    href: "/blog",
    title: "Blog | Sergio Flores",
    description: "Notes on software engineering, design and life.",
  },
];

export const story = {
  href: "/about/story",
  label: "More about me",
  title: "More about me — Sergio Flores",
  description: "The longer version of Sergio Flores' story, from Madrid.",
};

/** Every route rendered inside the home shell. */
export const shellPaths: string[] = ["/", ...sections.map((section) => section.href), story.href];

export function sectionById(id: SectionId): Section {
  const section = sections.find((entry) => entry.id === id);

  if (!section) throw new Error(`Unknown section: ${id}`);

  return section;
}
