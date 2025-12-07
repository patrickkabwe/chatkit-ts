import { Database } from "bun:sqlite";
import type {
  Attachment,
  Page,
  ThreadItem,
  ThreadMetadata
} from "../../../src";
import { Store } from "../../../src/store";

type SqlRow = Record<string, any>;

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function reviveItem(row: SqlRow): ThreadItem {
  const item = JSON.parse(String(row.item_json));
  if (item.created_at) {
    item.created_at = parseDate(item.created_at);
  }
  return item as ThreadItem;
}

function reviveThread(row: SqlRow): ThreadMetadata {
  return {
    id: row.id,
    created_at: parseDate(row.created_at),
    title: row.title ?? undefined,
    status: row.status ? JSON.parse(row.status) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  };
}

export interface User {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface RequestContext {
  userId: string;
}

/**
 * Persistent SQLite-backed Store with user authentication support.
 */
export class SqliteStore<TContext = RequestContext> extends Store<TContext> {
  private db: Database;

  constructor(dbPath = "./chatkit.db") {
    super();
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    // Enable foreign keys
    this.db.run("PRAGMA foreign_keys = ON");

    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Migrate: Add metadata column if it doesn't exist
    try {
      const tableInfo = this.db.query("PRAGMA table_info(users)").all() as Array<{ name: string }>;
      const hasMetadataColumn = tableInfo.some(col => col.name === "metadata");
      if (!hasMetadataColumn) {
        this.db.run(`ALTER TABLE users ADD COLUMN metadata TEXT`);
      }
    } catch (migrationError: any) {
      // If migration fails, log it but don't crash
      console.warn("Migration warning:", migrationError?.message || String(migrationError));
    }
    
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
    `);

    // Sessions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id
      ON sessions(user_id);
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
      ON sessions(expires_at);
    `);

    // Threads table with user_id
    this.db.run(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        title TEXT,
        status TEXT,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_threads_user_id
      ON threads(user_id);
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_threads_user_created
      ON threads(user_id, created_at);
    `);

    // Thread items table with user_id
    this.db.run(`
      CREATE TABLE IF NOT EXISTS thread_items (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        item_json TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_thread_items_thread_seq
      ON thread_items(thread_id, seq);
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_thread_items_user_thread
      ON thread_items(user_id, thread_id);
    `);

    // Attachments table with user_id
    this.db.run(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        mime_type TEXT NOT NULL,
        type TEXT NOT NULL,
        upload_url TEXT,
        preview_url TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_attachments_user_id
      ON attachments(user_id);
    `);
  }

  // User management methods
  async createUser(email: string, passwordHash: string, name?: string): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();
    
    this.db
      .query(
        `INSERT INTO users (id, email, name, password_hash, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, email, name ?? null, passwordHash, null, now, now);

    const row = this.db
      .query("SELECT * FROM users WHERE id = ?")
      .get(id) as SqlRow;

    return {
      id: row.id,
      email: row.email,
      name: row.name ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: parseDate(row.created_at),
      updated_at: parseDate(row.updated_at),
    };
  }

  async getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    const row = this.db
      .query("SELECT id, email, name, password_hash, metadata, created_at, updated_at FROM users WHERE email = ?")
      .get(email) as SqlRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name ?? undefined,
      password_hash: row.password_hash,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
      created_at: parseDate(row.created_at),
      updated_at: parseDate(row.updated_at),
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    const row = this.db
      .query("SELECT id, email, name, metadata, created_at, updated_at FROM users WHERE id = ?")
      .get(userId) as SqlRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name ?? undefined,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
      created_at: parseDate(row.created_at),
      updated_at: parseDate(row.updated_at),
    };
  }

  async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .query(
        `UPDATE users SET metadata = ?, updated_at = ? WHERE id = ?`
      )
      .run(JSON.stringify(metadata), now, userId);
  }

  // Session management methods
  async createSession(sessionId: string, userId: string, expiresAt: Date): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(sessionId, userId, expiresAt.toISOString(), now);
  }

  async getSession(sessionId: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const row = this.db
      .query("SELECT user_id, expires_at FROM sessions WHERE id = ?")
      .get(sessionId) as SqlRow | undefined;

    if (!row) return null;

    const expiresAt = parseDate(row.expires_at);
    if (expiresAt < new Date()) {
      // Session expired, delete it
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      userId: row.user_id,
      expiresAt,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.db.query("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date().toISOString();
    this.db.query("DELETE FROM sessions WHERE expires_at < ?").run(now);
  }

  async loadThread(threadId: string, context: TContext): Promise<ThreadMetadata> {
    const userId = (context as RequestContext).userId;
    const row = this.db
      .query("SELECT * FROM threads WHERE id = ? AND user_id = ?")
      .get(threadId, userId) as SqlRow | undefined;
    if (!row) {
      throw new Error(`Thread ${threadId} not found`);
    }
    return reviveThread(row);
  }

  async saveThread(thread: ThreadMetadata, context: TContext): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db
      .query(
        `
          INSERT INTO threads (id, user_id, created_at, title, status, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            status=excluded.status,
            metadata=excluded.metadata
        `
      )
      .run(
        thread.id,
        userId,
        thread.created_at.toISOString(),
        thread.title ?? null,
        thread.status ? JSON.stringify(thread.status) : null,
        thread.metadata ? JSON.stringify(thread.metadata) : null
      );
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    context: TContext
  ): Promise<Page<ThreadItem>> {
    const userId = (context as RequestContext).userId;
    let afterSeq: number | null = null;
    if (after) {
      const row = this.db
        .query("SELECT seq FROM thread_items WHERE id = ? AND user_id = ?")
        .get(after, userId) as { seq: number } | undefined;
      afterSeq = row?.seq ?? null;
    }

    const comparison =
      order === "asc"
        ? afterSeq !== null
          ? "AND seq > ?"
          : ""
        : afterSeq !== null
          ? "AND seq < ?"
          : "";

    const params: any[] = [threadId, userId];
    if (comparison) params.push(afterSeq);
    params.push(limit + 1);

    const rows = this.db
      .query(
        `
          SELECT * FROM thread_items
          WHERE thread_id = ? AND user_id = ? ${comparison}
          ORDER BY seq ${order.toUpperCase()}
          LIMIT ?
        `
      )
      .all(...params) as SqlRow[];

    const has_more = rows.length > limit;
    const pageRows = has_more ? rows.slice(0, limit) : rows;
    const data = pageRows.map(reviveItem);
    const last = pageRows[pageRows.length - 1];
    return {
      data,
      has_more,
      after: last ? last.id : null
    };
  }

  async saveAttachment(attachment: Attachment, context: TContext): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db
      .query(
        `
          INSERT INTO attachments (id, user_id, name, mime_type, type, upload_url, preview_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            mime_type=excluded.mime_type,
            type=excluded.type,
            upload_url=excluded.upload_url,
            preview_url=excluded.preview_url
        `
      )
      .run(
        attachment.id,
        userId,
        attachment.name ?? null,
        attachment.mime_type,
        attachment.type ?? "file",
        attachment.upload_url ?? null,
        attachment.preview_url ?? null
      );
  }

  async loadAttachment(attachmentId: string, context: TContext): Promise<Attachment> {
    const userId = (context as RequestContext).userId;
    const row = this.db
      .query("SELECT * FROM attachments WHERE id = ? AND user_id = ?")
      .get(attachmentId, userId) as SqlRow | undefined;
    if (!row) {
      throw new Error(`Attachment ${attachmentId} not found`);
    }
    return {
      id: row.id,
      name: row.name ?? undefined,
      mime_type: row.mime_type,
      type: row.type,
      upload_url: row.upload_url ?? null,
      preview_url: row.preview_url ?? null
    };
  }

  async deleteAttachment(attachmentId: string, context: TContext): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db.query("DELETE FROM attachments WHERE id = ? AND user_id = ?").run(attachmentId, userId);
  }

  async loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    context: TContext
  ): Promise<Page<ThreadMetadata>> {
    const userId = (context as RequestContext).userId;
    let afterCreated: string | null = null;
    if (after) {
      const row = this.db
        .query("SELECT created_at FROM threads WHERE id = ? AND user_id = ?")
        .get(after, userId) as { created_at: string } | undefined;
      afterCreated = row?.created_at ?? null;
    }

    const comparison =
      order === "asc"
        ? afterCreated
          ? "AND created_at > ?"
          : ""
        : afterCreated
          ? "AND created_at < ?"
          : "";

    const params: any[] = [userId];
    if (comparison) params.push(afterCreated);
    params.push(limit + 1);

    const rows = this.db
      .query(
        `
          SELECT * FROM threads
          WHERE user_id = ? ${comparison}
          ORDER BY created_at ${order.toUpperCase()}
          LIMIT ?
        `
      )
      .all(...params) as SqlRow[];

    const has_more = rows.length > limit;
    const pageRows = has_more ? rows.slice(0, limit) : rows;
    const data = pageRows.map(reviveThread);
    const last = pageRows[pageRows.length - 1];
    return {
      data,
      has_more,
      after: last ? last.id : null
    };
  }

  async addThreadItem(
    threadId: string,
    item: ThreadItem,
    context: TContext
  ): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db
      .query(
        `
          INSERT INTO thread_items (id, thread_id, user_id, created_at, item_json)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `
      )
      .run(
        item.id,
        threadId,
        userId,
        item.created_at
          ? item.created_at.toISOString()
          : new Date().toISOString(),
        JSON.stringify(item)
      );
  }

  async saveItem(
    threadId: string,
    item: ThreadItem,
    context: TContext
  ): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db
      .query(
        `
          INSERT INTO thread_items (id, thread_id, user_id, created_at, item_json)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            item_json=excluded.item_json,
            created_at=excluded.created_at
        `
      )
      .run(
        item.id,
        threadId,
        userId,
        item.created_at
          ? item.created_at.toISOString()
          : new Date().toISOString(),
        JSON.stringify(item)
      );
  }

  async loadItem(
    _threadId: string,
    itemId: string,
    context: TContext
  ): Promise<ThreadItem> {
    const userId = (context as RequestContext).userId;
    const row = this.db
      .query("SELECT * FROM thread_items WHERE id = ? AND user_id = ?")
      .get(itemId, userId) as SqlRow | undefined;
    if (!row) {
      throw new Error(`Item ${itemId} not found`);
    }
    return reviveItem(row);
  }

  async deleteThread(threadId: string, context: TContext): Promise<void> {
    const userId = (context as RequestContext).userId;
    const txn = this.db.transaction(() => {
      this.db.query("DELETE FROM thread_items WHERE thread_id = ? AND user_id = ?").run(threadId, userId);
      this.db.query("DELETE FROM threads WHERE id = ? AND user_id = ?").run(threadId, userId);
    });
    txn();
  }

  async deleteThreadItem(
    _threadId: string,
    itemId: string,
    context: TContext
  ): Promise<void> {
    const userId = (context as RequestContext).userId;
    this.db.query("DELETE FROM thread_items WHERE id = ? AND user_id = ?").run(itemId, userId);
  }
}
