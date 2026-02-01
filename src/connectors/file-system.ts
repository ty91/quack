import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import picomatch from "picomatch";
import { resolvePath } from "../utils/paths.js";
import type {
  Connector,
  DocumentMetadata,
  DocumentRef,
  FileSystemConnectorConfig,
  Source,
} from "./types.js";

const allowedExtensions = new Set([".md", ".markdown", ".txt"]);
const excludedDirectoryNames = new Set([".git", "node_modules", ".quack"]);
const maxFileSizeBytes = 5 * 1024 * 1024;

export class FileSystemConnector implements Connector {
  async listDocuments(source: Source): Promise<DocumentRef[]> {
    const config = resolveFileSystemConfig(source);
    const rootPath = resolvePath(config.rootPath);
    const includeMatcher = config.glob ? picomatch(config.glob, { dot: true }) : null;
    const excludeMatcher = config.exclude ? picomatch(config.exclude, { dot: true }) : null;

    const documents: DocumentRef[] = [];

    await walkDirectory(rootPath, async (absolutePath, relativePath) => {
      if (!isAllowedExtension(relativePath)) {
        return;
      }

      if (excludeMatcher && excludeMatcher(relativePath)) {
        return;
      }

      if (includeMatcher && !includeMatcher(relativePath)) {
        return;
      }

      const stats = await fs.stat(absolutePath);
      if (stats.size > maxFileSizeBytes) {
        return;
      }

      documents.push({
        sourceId: source.id,
        path: relativePath,
        absolutePath,
      });
    });

    return documents;
  }

  async readDocument(document: DocumentRef): Promise<string> {
    const absolutePath = resolveDocumentPath(document);
    const stats = await fs.stat(absolutePath);

    if (stats.size > maxFileSizeBytes) {
      throw new Error(`File too large: ${absolutePath}`);
    }

    const content = await fs.readFile(absolutePath, "utf8");

    if (containsInvalidUtf8(content)) {
      console.warn(`Invalid UTF-8 content skipped: ${absolutePath}`);
      throw new Error(`Invalid UTF-8 content: ${absolutePath}`);
    }

    const normalized = normalizeText(content);
    const withoutFrontmatter = stripFrontmatter(normalized);
    return withoutFrontmatter.trim();
  }

  async getDocumentMetadata(document: DocumentRef): Promise<DocumentMetadata> {
    const absolutePath = resolveDocumentPath(document);
    const stats = await fs.stat(absolutePath);

    if (stats.size > maxFileSizeBytes) {
      throw new Error(`File too large: ${absolutePath}`);
    }

    return {
      mtime: Math.floor(stats.mtimeMs),
      size: stats.size,
      hash: await hashFile(absolutePath),
    };
  }
}

function resolveFileSystemConfig(source: Source): FileSystemConnectorConfig {
  const config = source.connectorConfig as FileSystemConnectorConfig;
  if (!config?.rootPath) {
    throw new Error(`Missing rootPath for source: ${source.name}`);
  }
  return config;
}

async function walkDirectory(
  rootPath: string,
  visitor: (absolutePath: string, relativePath: string) => Promise<void>,
): Promise<void> {
  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.name.startsWith(".")) {
        continue;
      }

      const absolutePath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (excludedDirectoryNames.has(entry.name)) {
          continue;
        }
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = normalizeRelativePath(path.relative(rootPath, absolutePath));
      await visitor(absolutePath, relativePath);
    }
  }

  await walk(rootPath);
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isAllowedExtension(filePath: string): boolean {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function resolveDocumentPath(document: DocumentRef): string {
  if (document.absolutePath) {
    return document.absolutePath;
  }

  throw new Error(`Document path missing absolutePath: ${document.path}`);
}

function containsInvalidUtf8(content: string): boolean {
  return content.includes("\uFFFD");
}

function normalizeText(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content;
  }

  const match = /^---\n[\s\S]*?\n---\n?/u.exec(content);
  return match ? content.slice(match[0].length) : content;
}

async function hashFile(absolutePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}
