# Stores Documentation

Stores handle persistence of threads, messages, attachments, and other chat data. This document covers the store interface and provided implementations.

## Table of Contents

- [Overview](#overview)
- [Store Interface](#store-interface)
- [AttachmentStore Interface](#attachmentstore-interface)
- [Provided Implementations](#provided-implementations)
- [Custom Store Implementation](#custom-store-implementation)
- [Best Practices](#best-practices)

## Overview

The ChatKit SDK uses a pluggable storage architecture. You must implement a `Store` to persist:

- Threads (metadata, status, title)
- Thread items (messages, widgets, tool calls, etc.)
- Attachments (metadata)

Optionally, implement an `AttachmentStore` to handle file storage:

- File upload URLs
- File storage and retrieval
- File deletion

## Store Interface

All stores must extend the abstract `Store` class and implement required methods.

### Core Methods

#### Thread Management

```typescript
abstract loadThread(
  threadId: string,
  context: TContext
): Promise<ThreadMetadata>;

abstract saveThread(
  thread: ThreadMetadata,
  context: TContext
): Promise<void>;

abstract loadThreads(
  limit: number,
  after: string | null,
  order: "asc" | "desc",
  context: TContext
): Promise<Page<ThreadMetadata>>;

abstract deleteThread(
  threadId: string,
  context: TContext
): Promise<void>;
```

#### Thread Item Management

```typescript
abstract loadThreadItems(
  threadId: string,
  after: string | null,
  limit: number,
  order: "asc" | "desc",
  context: TContext
): Promise<Page<ThreadItem>>;

abstract addThreadItem(
  threadId: string,
  item: ThreadItem,
  context: TContext
): Promise<void>;

abstract saveItem(
  threadId: string,
  item: ThreadItem,
  context: TContext
): Promise<void>;

abstract loadItem(
  threadId: string,
  itemId: string,
  context: TContext
): Promise<ThreadItem>;

abstract deleteThreadItem(
  threadId: string,
  itemId: string,
  context: TContext
): Promise<void>;
```

#### Attachment Management

```typescript
abstract saveAttachment(
  attachment: Attachment,
  context: TContext
): Promise<void>;

abstract loadAttachment(
  attachmentId: string,
  context: TContext
): Promise<Attachment>;

abstract deleteAttachment(
  attachmentId: string,
  context: TContext
): Promise<void>;
```

#### ID Generation

```typescript
generateThreadId(context: TContext): string {
  return defaultGenerateId("thread");
}

generateItemId(
  itemType: StoreItemType,
  thread: ThreadMetadata,
  context: TContext
): string {
  return defaultGenerateId(itemType);
}
```

Override these to customize ID generation.

### StoreItemType

Valid item types:

- `"thread"`
- `"message"`
- `"tool_call"`
- `"task"`
- `"workflow"`
- `"attachment"`
- `"sdk_hidden_context"`

### Pagination

All list methods return a `Page<T>`:

```typescript
interface Page<T> {
  data: T[];
  has_more: boolean;
  after?: string | null;
}
```

The `after` cursor should identify the last item in the current page. Pass it back to get the next page.

### Context Type

`TContext` is a generic type for request-scoped data (user ID, session info, etc.). Use it to:

- Implement multi-tenancy
- Pass database connections
- Access request metadata

## AttachmentStore Interface

Attachment stores handle file upload and storage.

### Methods

```typescript
abstract deleteAttachment(
  attachmentId: string,
  context: TContext
): Promise<void>;

async createAttachment(
  input: AttachmentCreateParams,
  context: TContext
): Promise<Attachment>;
```

### AttachmentCreateParams

```typescript
interface AttachmentCreateParams {
  name: string;
  size: number;
  mime_type: string;
}
```

### Return Value

`createAttachment` should return an `Attachment` with:

- `id`: Unique attachment ID
- `name`: Original filename
- `mime_type`: MIME type
- `type`: `"file"` or `"image"`
- `upload_url`: URL for uploading file data (for two-phase upload)
- `preview_url`: URL for viewing/downloading the file (optional)

## Provided Implementations

### In-Memory Store

**Note**: No in-memory store is provided by default. You must implement your own or use an example implementation.

### Disk Attachment Store

Stores files on the local filesystem.

```typescript
import { DiskAttachmentStore } from "chatkit-ts";

const attachmentStore = new DiskAttachmentStore(
  "./attachments",  // Base directory
  "http://localhost:3000"  // Base URL for serving files
);
```

#### Configuration

- `baseDir`: Directory to store files (default: `"./attachments"`)
- `baseUrl`: Base URL for generating file URLs (default: from `BASE_URL` env var or `"http://localhost:3000"`)

#### Methods

```typescript
// Create attachment (returns upload URL)
const attachment = await attachmentStore.createAttachment({
  name: "document.pdf",
  size: 1024,
  mime_type: "application/pdf"
}, context);

// Store file data (called by upload endpoint)
await attachmentStore.storeFileData(attachment.id, fileData);

// Get file data
const data = await attachmentStore.getFileData(attachment.id);

// Get file URL
const url = attachmentStore.getFileUrl(attachment.id);

// Delete file
await attachmentStore.deleteAttachment(attachment.id, context);
```

#### File URLs

Generated URLs:
- Upload: `${baseUrl}/api/chatkit/attachments/${id}/upload`
- Download: `${baseUrl}/api/chatkit/attachments/${id}/file`

You need to implement HTTP endpoints to handle these URLs.

### AWS S3 Attachment Store

Stores files in AWS S3 with presigned URLs.

```typescript
import { AwsAttachmentStore } from "chatkit-ts";

const attachmentStore = new AwsAttachmentStore({
  bucket: "my-attachments-bucket",
  region: "us-east-1",
  keyPrefix: "attachments/",  // Optional
  credentials: {  // Optional (uses default credential chain if not provided)
    accessKeyId: "AKIA...",
    secretAccessKey: "..."
  },
  endpoint: "https://s3.amazonaws.com",  // Optional (for S3-compatible services)
  baseUrl: "https://cdn.example.com",  // Optional (for custom CDN)
  urlExpirationSeconds: 3600  // Optional (default: 1 hour)
});
```

#### Configuration

- `bucket`: S3 bucket name (required)
- `region`: AWS region (required)
- `keyPrefix`: Prefix for all S3 keys (optional)
- `credentials`: AWS credentials (optional, uses default chain)
- `endpoint`: Custom S3 endpoint (optional, for MinIO, etc.)
- `baseUrl`: Base URL for preview URLs (optional, uses presigned URLs if not provided)
- `urlExpirationSeconds`: Presigned URL expiration (default: 3600)

#### Features

- **Presigned URLs**: Secure upload/download URLs that expire
- **Key Prefixing**: Organize files with prefixes
- **S3-Compatible**: Works with MinIO and other S3-compatible services
- **CDN Support**: Optionally generate CDN URLs instead of presigned URLs

#### Methods

```typescript
// Create attachment (returns presigned upload URL)
const attachment = await attachmentStore.createAttachment({
  name: "document.pdf",
  size: 1024,
  mime_type: "application/pdf"
}, context);

// Upload file using presigned URL (client-side)
// POST to attachment.upload_url with file data

// Get presigned download URL
const downloadUrl = await attachmentStore.getDownloadUrl(attachment.id);

// Delete file
await attachmentStore.deleteAttachment(attachment.id, context);
```

## Custom Store Implementation

### Example: SQLite Store

```typescript
import { Store, ThreadMetadata, ThreadItem, Attachment, Page } from "chatkit-ts";
import Database from "better-sqlite3";

class SqliteStore extends Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT NOT NULL,
        status TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS thread_items (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );

      CREATE INDEX IF NOT EXISTS idx_thread_items_thread_id 
        ON thread_items(thread_id, created_at);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        type TEXT NOT NULL,
        upload_url TEXT,
        preview_url TEXT,
        created_at TEXT
      );
    `);
  }

  async loadThread(threadId: string, context: any): Promise<ThreadMetadata> {
    const row = this.db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(threadId) as any;

    if (!row) {
      throw new NotFoundError(`Thread ${threadId} not found`);
    }

    return {
      id: row.id,
      title: row.title,
      created_at: new Date(row.created_at),
      status: row.status ? JSON.parse(row.status) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  async saveThread(thread: ThreadMetadata, context: any): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO threads (id, title, created_at, status, metadata)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        thread.id,
        thread.title,
        thread.created_at.toISOString(),
        thread.status ? JSON.stringify(thread.status) : null,
        thread.metadata ? JSON.stringify(thread.metadata) : null
      );
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    context: any
  ): Promise<Page<ThreadItem>> {
    const orderClause = order === "asc" ? "ASC" : "DESC";
    const afterClause = after
      ? `AND created_at ${order === "asc" ? ">" : "<"} (SELECT created_at FROM thread_items WHERE id = ?)`
      : "";
    const params = after ? [threadId, after, limit + 1] : [threadId, limit + 1];

    const rows = this.db
      .prepare(
        `SELECT * FROM thread_items 
         WHERE thread_id = ? ${afterClause}
         ORDER BY created_at ${orderClause}
         LIMIT ?`
      )
      .all(...params) as any[];

    const items = rows.slice(0, limit).map(row => JSON.parse(row.data));
    const has_more = rows.length > limit;

    return {
      data: items,
      has_more,
      after: has_more ? items[items.length - 1].id : null
    };
  }

  async addThreadItem(
    threadId: string,
    item: ThreadItem,
    context: any
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO thread_items (id, thread_id, type, data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        threadId,
        item.type,
        JSON.stringify(item),
        item.created_at.toISOString()
      );
  }

  async saveItem(
    threadId: string,
    item: ThreadItem,
    context: any
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE thread_items 
         SET data = ?
         WHERE id = ? AND thread_id = ?`
      )
      .run(JSON.stringify(item), item.id, threadId);
  }

  async loadItem(
    threadId: string,
    itemId: string,
    context: any
  ): Promise<ThreadItem> {
    const row = this.db
      .prepare("SELECT * FROM thread_items WHERE id = ? AND thread_id = ?")
      .get(itemId, threadId) as any;

    if (!row) {
      throw new NotFoundError(`Item ${itemId} not found in thread ${threadId}`);
    }

    return JSON.parse(row.data);
  }

  async deleteThreadItem(
    threadId: string,
    itemId: string,
    context: any
  ): Promise<void> {
    this.db
      .prepare("DELETE FROM thread_items WHERE id = ? AND thread_id = ?")
      .run(itemId, threadId);
  }

  async loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    context: any
  ): Promise<Page<ThreadMetadata>> {
    const orderClause = order === "asc" ? "ASC" : "DESC";
    const afterClause = after
      ? `WHERE created_at ${order === "asc" ? ">" : "<"} (SELECT created_at FROM threads WHERE id = ?)`
      : "";
    const params = after ? [after, limit + 1] : [limit + 1];

    const rows = this.db
      .prepare(
        `SELECT * FROM threads ${afterClause}
         ORDER BY created_at ${orderClause}
         LIMIT ?`
      )
      .all(...params) as any[];

    const threads = rows.slice(0, limit).map(row => ({
      id: row.id,
      title: row.title,
      created_at: new Date(row.created_at),
      status: row.status ? JSON.parse(row.status) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));

    return {
      data: threads,
      has_more: rows.length > limit,
      after: rows.length > limit ? threads[threads.length - 1].id : null
    };
  }

  async deleteThread(threadId: string, context: any): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM thread_items WHERE thread_id = ?").run(threadId);
      this.db.prepare("DELETE FROM threads WHERE id = ?").run(threadId);
    })();
  }

  async saveAttachment(attachment: Attachment, context: any): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO attachments 
         (id, name, mime_type, type, upload_url, preview_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        attachment.id,
        attachment.name,
        attachment.mime_type,
        attachment.type,
        attachment.upload_url,
        attachment.preview_url,
        attachment.created_at?.toISOString() || new Date().toISOString()
      );
  }

  async loadAttachment(
    attachmentId: string,
    context: any
  ): Promise<Attachment> {
    const row = this.db
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(attachmentId) as any;

    if (!row) {
      throw new NotFoundError(`Attachment ${attachmentId} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      mime_type: row.mime_type,
      type: row.type as "file" | "image",
      upload_url: row.upload_url,
      preview_url: row.preview_url,
      created_at: row.created_at ? new Date(row.created_at) : null
    };
  }

  async deleteAttachment(attachmentId: string, context: any): Promise<void> {
    this.db.prepare("DELETE FROM attachments WHERE id = ?").run(attachmentId);
  }
}
```

### Example: PostgreSQL Store

Similar structure but using `pg` library:

```typescript
import { Pool } from "pg";

class PostgresStore extends Store {
  private pool: Pool;

  constructor(connectionString: string) {
    super();
    this.pool = new Pool({ connectionString });
    this.initSchema();
  }

  // ... implement methods using this.pool.query()
}
```

## Best Practices

### 1. Transaction Support

Use transactions for operations that modify multiple records:

```typescript
async deleteThread(threadId: string, context: any): Promise<void> {
  // Delete items first, then thread
  await this.db.transaction(async (tx) => {
    await tx.query("DELETE FROM thread_items WHERE thread_id = $1", [threadId]);
    await tx.query("DELETE FROM threads WHERE id = $1", [threadId]);
  });
}
```

### 2. Efficient Pagination

Index on `(thread_id, created_at)` for fast item queries:

```sql
CREATE INDEX idx_thread_items_thread_id_created 
ON thread_items(thread_id, created_at);
```

### 3. JSON Storage

Store thread items as JSON for flexibility:

```typescript
// Serialize
const json = JSON.stringify(item);

// Deserialize
const item = JSON.parse(json) as ThreadItem;
```

### 4. Error Handling

Throw `NotFoundError` for missing resources:

```typescript
import { NotFoundError } from "chatkit-ts";

if (!item) {
  throw new NotFoundError(`Item ${itemId} not found`);
}
```

### 5. Connection Pooling

Use connection pools for database stores:

```typescript
class MyStore extends Store {
  private pool: Pool;

  constructor() {
    super();
    this.pool = new Pool({
      max: 20,
      idleTimeoutMillis: 30000
    });
  }
}
```

### 6. Caching

Consider caching frequently accessed threads:

```typescript
private cache = new Map<string, ThreadMetadata>();

async loadThread(threadId: string, context: any): Promise<ThreadMetadata> {
  if (this.cache.has(threadId)) {
    return this.cache.get(threadId)!;
  }
  
  const thread = await this.loadFromDB(threadId);
  this.cache.set(threadId, thread);
  return thread;
}
```

### 7. Multi-Tenancy

Use context for tenant isolation:

```typescript
async loadThread(threadId: string, context: any): Promise<ThreadMetadata> {
  const { tenantId } = context;
  return this.db.query(
    "SELECT * FROM threads WHERE id = $1 AND tenant_id = $2",
    [threadId, tenantId]
  );
}
```

