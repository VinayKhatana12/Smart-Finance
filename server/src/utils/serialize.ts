/**
 * BigInt leaves the API as strings — JSON.stringify cannot carry bigint, and
 * string paise keep every digit intact for any client. All arithmetic happens
 * in bigint on the server; these mappers are the only place rows become JSON.
 */
export const paiseToJson = (value: bigint): string => value.toString();

/** Client input is integer paise within the safe-integer range; parse defensively. */
export function jsonToPaise(value: unknown): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`Not a safe integer paise value: ${String(value)}`);
}

export const twoDecimals = (paise: bigint): string => (Number(paise) / 100).toFixed(2);
