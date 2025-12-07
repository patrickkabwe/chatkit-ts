import { randomBytes, pbkdf2Sync } from "crypto";
import type { SqliteStore } from "./services/sqlite.store";

// Session expiration time (24 hours)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

let sessionStore: SqliteStore | null = null;

export function setSessionStore(store: SqliteStore): void {
  sessionStore = store;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;
  const computedHash = pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return computedHash === storedHash;
}

export async function createSession(userId: string): Promise<string> {
  if (!sessionStore) {
    throw new Error("Session store not initialized");
  }

  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  await sessionStore.createSession(sessionId, userId, expiresAt);
  
  // Clean up expired sessions periodically (every 100th session)
  if (Math.random() < 0.01) {
    await sessionStore.cleanupExpiredSessions();
  }
  
  return sessionId;
}

export async function getUserIdFromSession(sessionId: string | null): Promise<string | null> {
  if (!sessionId || !sessionStore) return null;
  
  const session = await sessionStore.getSession(sessionId);
  if (!session) return null;
  
  return session.userId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionStore) return;
  await sessionStore.deleteSession(sessionId);
}

export function getSessionFromRequest(req: Request): string | null {
  // Check cookie first
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map(c => {
        const [key, ...values] = c.split("=");
        return [key, values.join("=")];
      })
    );
    if (cookies.sessionId) {
      return cookies.sessionId;
    }
  }
  
  // Fallback to Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  return null;
}
