function secureRandomIndex(length: number) {
  if (length <= 1) return 0;
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

/** Randomize across people, not just rows. As long as another friend still has
 * an activity, the same person will never occupy two neighboring cards. */
export function mixFriendActivities<T extends { friend: { id: string } }>(
  items: T[],
  randomIndex: (length: number) => number = secureRandomIndex,
) {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const bucket = buckets.get(item.friend.id) ?? [];
    bucket.push(item);
    buckets.set(item.friend.id, bucket);
  }

  for (const bucket of buckets.values()) {
    for (let index = bucket.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [bucket[index], bucket[swapIndex]] = [bucket[swapIndex], bucket[index]];
    }
  }

  const mixed: T[] = [];
  let previousFriendId: string | null = null;
  while (mixed.length < items.length) {
    const available = [...buckets.entries()].filter(([, bucket]) => bucket.length > 0);
    const alternatives = available.filter(([friendId]) => friendId !== previousFriendId);
    const choices = alternatives.length ? alternatives : available;
    const [friendId, bucket] = choices[randomIndex(choices.length)];
    const next = bucket.pop();
    if (!next) break;
    mixed.push(next);
    previousFriendId = friendId;
  }
  return mixed;
}
