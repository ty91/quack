import type { Database as SqliteDatabase } from "better-sqlite3";

type Migration = {
  version: number;
  statements: string[];
};

const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS "app-meta" (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        connector_type TEXT NOT NULL,
        connector_config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(name)
      )`,
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        hash TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(source_id, path),
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS files_source_id_is_deleted
        ON files (source_id, is_deleted)`,
      `CREATE INDEX IF NOT EXISTS files_hash
        ON files (hash)`,
      `CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        token_count INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(file_id, chunk_index),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS chunks_file_id_is_deleted
        ON chunks (file_id, is_deleted)`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS "chunks-fts"
        USING fts5(
          chunk_id UNINDEXED,
          text,
          is_deleted UNINDEXED,
          source_id UNINDEXED
        )`,
      `CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id INTEGER NOT NULL,
        vector_id INTEGER NOT NULL,
        model_name TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(chunk_id, model_name),
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS embeddings_vector_id
        ON embeddings (vector_id)`,
      `CREATE TABLE IF NOT EXISTS "sync-runs" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL,
        changed_count INTEGER NOT NULL,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS sync_runs_source_id_started_at
        ON "sync-runs" (source_id, started_at)`,
    ],
  },
];

export function applyMigrations(database: SqliteDatabase): void {
  ensureMetaTable(database);
  const currentVersion = getSchemaVersion(database);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const applyMigration = database.transaction(() => {
      for (const statement of migration.statements) {
        database.exec(statement);
      }
      setSchemaVersion(database, migration.version);
      setLastMigrationTimestamp(database);
    });

    applyMigration();
  }
}

function ensureMetaTable(database: SqliteDatabase): void {
  database.exec(`CREATE TABLE IF NOT EXISTS "app-meta" (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
}

function getSchemaVersion(database: SqliteDatabase): number {
  const row = database
    .prepare(`SELECT value FROM "app-meta" WHERE key = ?`)
    .get("schema_version") as { value?: string } | undefined;

  if (!row?.value) {
    return 0;
  }

  const parsed = Number.parseInt(row.value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function setSchemaVersion(database: SqliteDatabase, version: number): void {
  database
    .prepare(`INSERT OR REPLACE INTO "app-meta" (key, value) VALUES (?, ?)`)
    .run("schema_version", String(version));
}

function setLastMigrationTimestamp(database: SqliteDatabase): void {
  database
    .prepare(`INSERT OR REPLACE INTO "app-meta" (key, value) VALUES (?, ?)`)
    .run("last_migration_at", new Date().toISOString());
}
