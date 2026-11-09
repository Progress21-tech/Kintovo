export function calculateCreatorBonus(amount: number, rateBasisPoints: number, cap: number | null, alreadyAwarded: number) {
  if (![amount, rateBasisPoints, alreadyAwarded].every(Number.isSafeInteger) || amount < 0 || rateBasisPoints < 0 || alreadyAwarded < 0) return 0;
  const raw = Math.floor((amount * rateBasisPoints) / 10_000);
  if (cap === null) return raw;
  if (!Number.isSafeInteger(cap) || cap < 0) return 0;
  return Math.max(0, Math.min(raw, cap - alreadyAwarded));
}

export function validManualAttributionEventId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,99}$/.test(value);
}
