import fs from "node:fs/promises";
import type { Dirent, Stats } from "node:fs";
import path from "node:path";
import { resolvePath } from "../../utils/paths.js";

type ResolveModelPathOptions = {
  modelPath?: string;
  modelId: string;
  cacheDir: string;
};

const ggufExtension = ".gguf";

export async function resolveEmbeddingModelPath(options: ResolveModelPathOptions): Promise<string> {
  if (options.modelPath) {
    const resolved = resolvePath(options.modelPath);
    await ensureFileExists(resolved);
    return resolved;
  }

  const baseDir = path.join(resolvePath(options.cacheDir), "embedding");
  const modelId = options.modelId.trim();

  const directCandidates = buildDirectCandidates(baseDir, modelId);
  for (const candidate of directCandidates) {
    const stat = await statIfExists(candidate);
    if (!stat) {
      continue;
    }
    if (stat.isFile()) {
      return candidate;
    }
    if (stat.isDirectory()) {
      const fromDir = await resolveSingleGgufInDirectory(candidate);
      if (fromDir) {
        return fromDir;
      }
    }
  }

  const fallback = await resolveSingleGgufInDirectory(baseDir);
  if (fallback) {
    return fallback;
  }

  throw new Error(
    `Embedding model file not found. Set models.embedding.modelPath or place a GGUF file under ${baseDir}.`,
  );
}

function buildDirectCandidates(baseDir: string, modelId: string): string[] {
  if (!modelId) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(path.join(baseDir, modelId));

  if (!modelId.endsWith(ggufExtension)) {
    candidates.add(path.join(baseDir, `${modelId}${ggufExtension}`));
  }

  const normalized = modelId.replace(/[\\/]/g, "__");
  candidates.add(path.join(baseDir, `${normalized}${ggufExtension}`));

  return [...candidates];
}

async function resolveSingleGgufInDirectory(directoryPath: string): Promise<string | null> {
  const entries = await safeReadDir(directoryPath);
  if (!entries) {
    return null;
  }

  const ggufFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(ggufExtension))
    .map((entry) => path.join(directoryPath, entry.name));

  if (ggufFiles.length === 1) {
    return ggufFiles[0];
  }

  if (ggufFiles.length > 1) {
    throw new Error(
      `Multiple GGUF files found in ${directoryPath}. Set models.embedding.modelPath explicitly.`,
    );
  }

  return null;
}

async function ensureFileExists(filePath: string): Promise<void> {
  const stat = await statIfExists(filePath);
  if (!stat || !stat.isFile()) {
    throw new Error(`Embedding model file not found at ${filePath}`);
  }
}

async function statIfExists(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function safeReadDir(directoryPath: string): Promise<Dirent[] | null> {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return null;
  }
}
