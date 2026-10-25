/** The tabs of the rules help, in the order they are shown. */
export const HELP_TABS = [
  'basics',
  'movement',
  'combat',
  'morale',
  'units',
  'terrain',
  'controls',
] as const;

export type HelpTab = (typeof HELP_TABS)[number];
