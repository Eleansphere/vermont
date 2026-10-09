/** One side of the conflict: the unit types its armies are put together from. */
export interface FactionDef {
  readonly id: string;
  readonly name: string;
  /** Ids of the faction's unit types. */
  readonly unitTypes: readonly string[];
}

export type FactionTable = Readonly<Record<string, FactionDef>>;
