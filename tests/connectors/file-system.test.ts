import { describe, expect, it, afterEach, beforeEach } from "vitest";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { FileSystemConnector } from "../../src/connectors/file-system.js";
import type { DocumentRef, Source } from "../../src/connectors/types.js";

const connector = new FileSystemConnector();

let rootPath = "";

beforeEach(async () => {
  rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "quack-"));

  await createFile(
    path.join(rootPath, "notes", "valid.md"),
    `---
title: Test
---
Line 1\r
\r
Line 2\r
`,
  );
  await createFile(path.join(rootPath, "notes", "keep.txt"), "keep");
  await createFile(path.join(rootPath, "notes", "readme.markdown"), "readme");
  await createFile(path.join(rootPath, "notes", "skip.bin"), "binary");
  await createFile(path.join(rootPath, ".hidden", "secret.txt"), "secret");
  await createFile(path.join(rootPath, ".git", "ignored.md"), "ignored");
  await createFile(path.join(rootPath, "node_modules", "module.txt"), "module");

  const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
  await createFile(path.join(rootPath, "big.txt"), largeBuffer);
});

afterEach(async () => {
  if (rootPath) {
    await fs.rm(rootPath, { recursive: true, force: true });
  }
});

describe("FileSystemConnector", () => {
  it("lists documents with ingestion defaults", async () => {
    const source = createSource({ rootPath });
    const documents = await connector.listDocuments(source);
    const paths = documents.map((document) => document.path).sort();

    expect(paths).toEqual(["notes/keep.txt", "notes/readme.markdown", "notes/valid.md"]);
  });

  it("reads documents with normalization and frontmatter removal", async () => {
    const document = createDocumentRef("notes/valid.md");
    const content = await connector.readDocument(document);
    expect(content).toBe("Line 1\n\nLine 2");
  });

  it("throws on invalid utf-8 content", async () => {
    const invalidPath = path.join(rootPath, "notes", "invalid.txt");
    await createFile(invalidPath, Buffer.from([0xff, 0xfe, 0xfd]));

    const document: DocumentRef = {
      sourceId: 1,
      path: "notes/invalid.txt",
      absolutePath: invalidPath,
    };

    await expect(connector.readDocument(document)).rejects.toThrow(/Invalid UTF-8/);
  });

  it("returns metadata with hash", async () => {
    const document = createDocumentRef("notes/keep.txt");
    const metadata = await connector.getDocumentMetadata(document);
    const content = await fs.readFile(document.absolutePath ?? "", "utf8");

    const expectedHash = createHash("sha256").update(content).digest("hex");
    const stats = await fs.stat(document.absolutePath ?? "");

    expect(metadata.hash).toBe(expectedHash);
    expect(metadata.size).toBe(stats.size);
    expect(metadata.mtime).toBe(Math.floor(stats.mtimeMs));
  });
});

async function createFile(filePath: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

function createSource(config: { rootPath: string }): Source {
  return {
    id: 1,
    name: "local",
    connectorType: "file-system",
    connectorConfig: {
      rootPath: config.rootPath,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDocumentRef(relativePath: string): DocumentRef {
  return {
    sourceId: 1,
    path: relativePath,
    absolutePath: path.join(rootPath, relativePath),
  };
}
