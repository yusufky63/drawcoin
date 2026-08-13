export class BoundedTtlCache<T> {
  private readonly values = new Map<
    string,
    { value: T; expiresAt: number }
  >();

  constructor(
    private readonly maximumEntries: number,
    private readonly ttlMs: number
  ) {}

  get(key: string, now = Date.now()) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.values.delete(key);
      return undefined;
    }

    // Refresh insertion order so frequently used entries survive eviction.
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()) {
    this.values.delete(key);
    while (this.values.size >= this.maximumEntries) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (!oldest) break;
      this.values.delete(oldest);
    }
    this.values.set(key, { value, expiresAt: now + this.ttlMs });
  }
}
