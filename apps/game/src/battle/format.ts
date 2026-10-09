const LOCALE = 'cs';

/** A number as the interface shows it: "0,5", not "0.5". */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

/** A bonus or penalty with its sign: "+2", "−1". */
export function formatSigned(value: number): string {
  return `${value < 0 ? '−' : '+'}${formatNumber(Math.abs(value))}`;
}
