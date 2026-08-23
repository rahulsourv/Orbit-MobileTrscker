import clsx from "clsx";

// Tailwind v4 plus clsx is enough here: the components below compose classes
// rather than fight over conflicting ones, so a full merge pass is not needed.
export const cn = (...inputs) => clsx(inputs);
