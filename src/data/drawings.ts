import zaltorLogo from "../assets/logos/zaltor-logo.png";

/** Images the dot field draws while a Work entry is read; client scripts import only this. */
export const fieldDrawings = {
  zaltor: zaltorLogo.src,
  ambar: "/mark-field.svg",
};

/** Work drawings in reading order; the pane opens on the first. */
export const workDrawings: string[] = [fieldDrawings.zaltor, fieldDrawings.ambar];
