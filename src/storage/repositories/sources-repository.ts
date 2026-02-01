import type { Database as SqliteDatabase } from "better-sqlite3";
import { getIsoTimestamp } from "../time.js";
import type { SourceRecord } from "../types.js";

type SourceRow = {
  id: number;
  name: string;
  connector_type: string;
  connector_config_json: string;
  created_at: string;
  updated_at: string;
};

type CreateSourceInput = {
  name: string;
  connectorType: string;
  connectorConfig: Record<string, unknown>;
};

type UpdateSourceInput = {
  id: number;
  name: string;
  connectorType: string;
  connectorConfig: Record<string, unknown>;
};

export function createSourcesRepository(database: SqliteDatabase) {
  const insertStatement = database.prepare(
    `INSERT INTO sources (name, connector_type, connector_config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const updateStatement = database.prepare(
    `UPDATE sources
     SET name = ?, connector_type = ?, connector_config_json = ?, updated_at = ?
     WHERE id = ?`,
  );
  const deleteStatement = database.prepare(`DELETE FROM sources WHERE id = ?`);
  const findByIdStatement = database.prepare(`SELECT * FROM sources WHERE id = ?`);
  const findByNameStatement = database.prepare(`SELECT * FROM sources WHERE name = ?`);
  const listStatement = database.prepare(`SELECT * FROM sources ORDER BY name ASC`);

  function createSource(input: CreateSourceInput): SourceRecord {
    const timestamp = getIsoTimestamp();
    const connectorConfigJson = JSON.stringify(input.connectorConfig);
    const result = insertStatement.run(
      input.name,
      input.connectorType,
      connectorConfigJson,
      timestamp,
      timestamp,
    );
    const row = findByIdStatement.get(result.lastInsertRowid) as SourceRow;
    return mapSourceRow(row);
  }

  function updateSource(input: UpdateSourceInput): SourceRecord {
    const timestamp = getIsoTimestamp();
    const connectorConfigJson = JSON.stringify(input.connectorConfig);
    updateStatement.run(input.name, input.connectorType, connectorConfigJson, timestamp, input.id);
    const row = findByIdStatement.get(input.id) as SourceRow;
    return mapSourceRow(row);
  }

  function deleteSource(id: number): void {
    deleteStatement.run(id);
  }

  function getSourceById(id: number): SourceRecord | null {
    const row = findByIdStatement.get(id) as SourceRow | undefined;
    return row ? mapSourceRow(row) : null;
  }

  function getSourceByName(name: string): SourceRecord | null {
    const row = findByNameStatement.get(name) as SourceRow | undefined;
    return row ? mapSourceRow(row) : null;
  }

  function listSources(): SourceRecord[] {
    const rows = listStatement.all() as SourceRow[];
    return rows.map(mapSourceRow);
  }

  return {
    createSource,
    updateSource,
    deleteSource,
    getSourceById,
    getSourceByName,
    listSources,
  };
}

function mapSourceRow(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    name: row.name,
    connectorType: row.connector_type,
    connectorConfig: parseConnectorConfig(row.connector_config_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseConnectorConfig(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
