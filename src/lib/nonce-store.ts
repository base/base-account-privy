const NONCE_TTL_MS = 10 * 60 * 1000;

interface StoredNonce {
  expiresAt: number;
}

class NonceStore {
  private nonces = new Map<string, StoredNonce>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Remove expired entries periodically without extending their individual lifetimes.
    this.cleanupInterval = setInterval(() => {
      this.removeExpired();
    }, NONCE_TTL_MS);
    this.cleanupInterval.unref?.();
  }

  add(nonce: string): void {
    this.removeExpired();
    this.nonces.set(nonce, { expiresAt: Date.now() + NONCE_TTL_MS });
  }

  // Consume a nonce only while it is present and unexpired.
  consume(nonce: string): boolean {
    const storedNonce = this.nonces.get(nonce);
    if (!storedNonce) {
      return false;
    }

    this.nonces.delete(nonce);
    return storedNonce.expiresAt > Date.now();
  }

  has(nonce: string): boolean {
    const storedNonce = this.nonces.get(nonce);
    if (!storedNonce) {
      return false;
    }

    if (storedNonce.expiresAt <= Date.now()) {
      this.nonces.delete(nonce);
      return false;
    }

    return true;
  }

  clear(): void {
    this.nonces.clear();
  }

  size(): number {
    this.removeExpired();
    return this.nonces.size;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.nonces.clear();
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [nonce, storedNonce] of this.nonces) {
      if (storedNonce.expiresAt <= now) {
        this.nonces.delete(nonce);
      }
    }
  }
}

// This store is process-local; production deployments must use shared durable storage for multi-instance replay protection.
export const nonceStore = new NonceStore();
