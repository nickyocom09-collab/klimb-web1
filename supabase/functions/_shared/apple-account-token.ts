/** Apple and UUID libraries may serialize the same UUID with different case. */
export function normalizeAppleAccountToken(value: string) {
  return value.trim().toLowerCase();
}

export function appleAccountTokensMatch(left: string, right: string) {
  return normalizeAppleAccountToken(left) === normalizeAppleAccountToken(right);
}
