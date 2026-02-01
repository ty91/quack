import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import { applyMigrations } from "./migrations.js";

type DatabaseOptions = {
  databasePath: string;
};

export async function openDatabase(options: DatabaseOptions): Promise<SqliteDatabase> {
  const databasePath = options.databasePath;

  if (databasePath !== ":memory:") {
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");

  applyMigrations(database);

  return database;
}
