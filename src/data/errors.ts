export interface ErrorInfo {
  code: string;
  message: string;
}

const fallback: ErrorInfo = {
  code: "Error",
  message: "Something went sideways.",
};

export const errors: Record<string, ErrorInfo> = {
  "403": { code: "403", message: "You're not on the list for this one." },
  "404": { code: "404", message: "This page doesn't exist. Maybe it never did." },
  "500": { code: "500", message: "Something broke on my end, not yours." },
};

export function getErrorInfo(code: string): ErrorInfo {
  return errors[code] ?? { ...fallback, code };
}

export const funnyMessages: string[] = [
  "It's not a bug, it's an undocumented feature.",
  "Blaming the intern (there is no intern).",
  "This page ran away from its problems.",
  "I swear this worked in production.",
  "Deploying vibes instead of fixes.",
  "Touching grass instead of fixing this.",
  "42% sure this is someone else's fault.",
  "Refactoring my excuses as we speak.",
];

/** Not part of the normal rotation — only shows up if you click the number. */
export const rareMessages: string[] = [
  "Okay, you actually clicked it. Respect.",
  "There's nothing else hiding in here. Probably.",
  "You found the one line that isn't in the loop.",
  "Sergio says hi. Now go outside.",
  "This message was written just for curious people like you.",
];
