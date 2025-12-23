/**
 * Simple Session Store
 * In-memory session storage (use Redis for production)
 */

interface Session {
  userId: number;
  linkedExchanges: string[];  // All exchanges user has linked
  activeExchange: string;      // Currently active exchange
  createdAt: number;
  expiresAt: number;
}

export class SessionStore {
  private static sessions: Map<string, Session> = new Map();
  private static SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static create(userId: number, linkedExchanges: string[], activeExchange?: string): string {
    // Generate simple session token
    const token = this.generateToken();
    const now = Date.now();

    // Use provided activeExchange or default to first linked exchange
    const active = activeExchange || linkedExchanges[0];

    this.sessions.set(token, {
      userId,
      linkedExchanges,
      activeExchange: active,
      createdAt: now,
      expiresAt: now + this.SESSION_DURATION
    });

    return token;
  }

  static get(token: string): Session | null {
    const session = this.sessions.get(token);
    
    if (!session) {
      return null;
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  static switchExchange(token: string, exchangeId: string): boolean {
    const session = this.sessions.get(token);
    
    if (!session) {
      return false;
    }

    // Validate that the exchange is linked
    if (!session.linkedExchanges.includes(exchangeId)) {
      throw new Error(`Exchange '${exchangeId}' is not linked to this account`);
    }

    // Update active exchange
    session.activeExchange = exchangeId;
    this.sessions.set(token, session);
    
    return true;
  }

  static delete(token: string): void {
    this.sessions.delete(token);
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }

  private static generateToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Cleanup expired sessions every hour
setInterval(() => SessionStore.cleanup(), 60 * 60 * 1000);
