import { describe, expect, it } from "vitest";
import {
  applyMigrations,
  createFilesRepository,
  createSourcesRepository,
  openDatabase,
} from "../../src/storage/index.js";

describe("storage schema", () => {
  it("applies migrations idempotently", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    applyMigrations(database);
    applyMigrations(database);

    const row = database
      .prepare(`SELECT value FROM "app-meta" WHERE key = ?`)
      .get("schema_version") as { value?: string } | undefined;

    expect(row?.value).toBe("1");
    database.close();
  });

  it("enforces unique source names", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    const sourcesRepository = createSourcesRepository(database);

    sourcesRepository.createSource({
      name: "notes",
      connectorType: "file-system",
      connectorConfig: { rootPath: "/tmp" },
    });

    expect(() =>
      sourcesRepository.createSource({
        name: "notes",
        connectorType: "file-system",
        connectorConfig: { rootPath: "/tmp" },
      }),
    ).toThrow(/UNIQUE constraint failed/);

    database.close();
  });

  it("enforces foreign keys on files", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    const filesRepository = createFilesRepository(database);

    expect(() =>
      filesRepository.createFile({
        sourceId: 9999,
        path: "missing.md",
        mtime: 0,
        size: 10,
        hash: "hash",
      }),
    ).toThrow(/FOREIGN KEY constraint failed/);

    database.close();
  });
});
