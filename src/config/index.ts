import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import toml from "@iarna/toml";
import { configSchema, type Config } from "./schema.js";
import { getDefaultConfig, getDefaultConfigPath } from "./defaults.js";
import { resolvePath } from "../utils/paths.js";

type ConfigLoadOptions = {
  configPath?: string;
  overrides?: Partial<Config>;
};

type ExplicitPaths = {
  dataDir: boolean;
  dbPath: boolean;
  vectorIndexPath: boolean;
  modelsCacheDir: boolean;
  embeddingModelPath: boolean;
  rerankerModelPath: boolean;
};

export type OutputFormat = "md" | "text" | "json";

const outputFormats: OutputFormat[] = ["md", "text", "json"];

export function parseOutputFormat(value: string): OutputFormat {
  if (outputFormats.includes(value as OutputFormat)) {
    return value as OutputFormat;
  }

  throw new Error(`Unsupported format: ${value}`);
}

export function getConfigFilePath(overridePath?: string): string {
  return overridePath ? resolvePath(overridePath) : getDefaultConfigPath();
}

export async function loadMergedConfig(options: ConfigLoadOptions): Promise<Config> {
  const defaultConfig = getDefaultConfig();
  const configPath = getConfigFilePath(options.configPath);
  const fileConfig = await loadConfigFile(configPath);
  const environmentConfig = loadEnvironmentConfig();
  const overrideConfig = options.overrides ?? {};

  const explicitPaths = collectExplicitPaths([fileConfig, environmentConfig, overrideConfig]);

  const mergedConfig = mergeDeep(defaultConfig, fileConfig, environmentConfig, overrideConfig);

  const withDerivedPaths = applyDerivedPaths(mergedConfig, explicitPaths);
  const resolvedPaths = resolveConfigPaths(withDerivedPaths);

  return configSchema.parse(resolvedPaths);
}

export async function writeDefaultConfigFile(configPath?: string): Promise<string> {
  const targetPath = getConfigFilePath(configPath);

  try {
    await fs.stat(targetPath);
    throw new Error(`Config file already exists: ${targetPath}`);
  } catch (error) {
    if (isNotFoundError(error)) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const content = formatConfigAsToml(getDefaultConfig(), true);
      await fs.writeFile(targetPath, content, "utf8");
      return targetPath;
    }

    throw error;
  }
}

export function formatConfigOutput(config: Config, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(stripUndefined(config), null, 2);
  }

  const tomlContent = formatConfigAsToml(config, false);

  if (format === "text") {
    return tomlContent;
  }

  return `# Config\n\n\`\`\`toml\n${tomlContent}\`\`\`\n`;
}

async function loadConfigFile(configPath: string): Promise<Partial<Config>> {
  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = toml.parse(content);

    if (!isPlainObject(parsed)) {
      throw new Error(`Invalid config format: ${configPath}`);
    }

    return parsed as Partial<Config>;
  } catch (error) {
    if (isNotFoundError(error)) {
      return {};
    }

    throw error;
  }
}

function loadEnvironmentConfig(): Partial<Config> {
  const environment = process.env;
  const config: Partial<Config> = {};

  const paths: Record<string, string> = {};
  setEnvironmentValue(environment, "QUACK_DATA_DIR", paths, "dataDir");
  setEnvironmentValue(environment, "QUACK_DB_PATH", paths, "dbPath");
  setEnvironmentValue(environment, "QUACK_VECTOR_INDEX_PATH", paths, "vectorIndexPath");

  if (Object.keys(paths).length > 0) {
    config.paths = paths as Config["paths"];
  }

  const models: Record<string, unknown> = {};
  setEnvironmentValue(environment, "QUACK_MODELS_CACHE_DIR", models, "cacheDir");

  const embedding: Record<string, unknown> = {};
  setEnvironmentValue(environment, "QUACK_EMBEDDING_PROVIDER", embedding, "provider");
  setEnvironmentValue(environment, "QUACK_EMBEDDING_MODEL_PATH", embedding, "modelPath");
  setEnvironmentValue(environment, "QUACK_EMBEDDING_MODEL_ID", embedding, "modelId");

  const embeddingDimension = parseIntegerEnvironment(environment.QUACK_EMBEDDING_DIMENSION);
  if (embeddingDimension !== undefined) {
    embedding.dimension = embeddingDimension;
  }

  if (Object.keys(embedding).length > 0) {
    models.embedding = embedding;
  }

  const reranker: Record<string, unknown> = {};
  setEnvironmentValue(environment, "QUACK_RERANKER_PROVIDER", reranker, "provider");
  setEnvironmentValue(environment, "QUACK_RERANKER_MODEL_PATH", reranker, "modelPath");
  setEnvironmentValue(environment, "QUACK_RERANKER_MODEL_ID", reranker, "modelId");

  if (Object.keys(reranker).length > 0) {
    models.reranker = reranker;
  }

  if (Object.keys(models).length > 0) {
    config.models = models as Config["models"];
  }

  const search: Record<string, number> = {};
  setIntegerEnvironment(environment, "QUACK_SEARCH_TOP", search, "top");
  setIntegerEnvironment(environment, "QUACK_BM25_K", search, "bm25K");
  setIntegerEnvironment(environment, "QUACK_VECTOR_K", search, "vectorK");
  setIntegerEnvironment(environment, "QUACK_RERANK_K", search, "rerankK");
  setIntegerEnvironment(environment, "QUACK_RRF_K", search, "rrfK");

  if (Object.keys(search).length > 0) {
    config.search = search as Config["search"];
  }

  const chunking: Record<string, number> = {};
  setIntegerEnvironment(environment, "QUACK_CHUNK_TOKENS", chunking, "chunkTokens");
  setIntegerEnvironment(environment, "QUACK_OVERLAP_TOKENS", chunking, "overlapTokens");

  if (Object.keys(chunking).length > 0) {
    config.chunking = chunking as Config["chunking"];
  }

  const providers: Record<string, string> = {};
  setEnvironmentValue(environment, "QUACK_PROVIDER_EMBEDDING", providers, "embedding");
  setEnvironmentValue(environment, "QUACK_PROVIDER_RERANKER", providers, "reranker");
  setEnvironmentValue(environment, "QUACK_PROVIDER_MIXER", providers, "mixer");
  setEnvironmentValue(environment, "QUACK_PROVIDER_CHUNKER", providers, "chunker");

  if (Object.keys(providers).length > 0) {
    config.providers = providers as Config["providers"];
  }

  return config;
}

function setEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  key: string,
  target: Record<string, unknown>,
  targetKey: string,
): void {
  const value = environment[key];
  if (value !== undefined && value !== "") {
    target[targetKey] = value;
  }
}

function setIntegerEnvironment(
  environment: NodeJS.ProcessEnv,
  key: string,
  target: Record<string, number>,
  targetKey: string,
): void {
  const value = parseIntegerEnvironment(environment[key]);
  if (value !== undefined) {
    target[targetKey] = value;
  }
}

function parseIntegerEnvironment(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function collectExplicitPaths(layers: Array<Partial<Config>>): ExplicitPaths {
  const explicit: ExplicitPaths = {
    dataDir: false,
    dbPath: false,
    vectorIndexPath: false,
    modelsCacheDir: false,
    embeddingModelPath: false,
    rerankerModelPath: false,
  };

  for (const layer of layers) {
    if (layer.paths) {
      if (hasOwnProperty(layer.paths, "dataDir")) {
        explicit.dataDir = true;
      }
      if (hasOwnProperty(layer.paths, "dbPath")) {
        explicit.dbPath = true;
      }
      if (hasOwnProperty(layer.paths, "vectorIndexPath")) {
        explicit.vectorIndexPath = true;
      }
    }

    if (layer.models) {
      if (hasOwnProperty(layer.models, "cacheDir")) {
        explicit.modelsCacheDir = true;
      }
      if (layer.models.embedding && hasOwnProperty(layer.models.embedding, "modelPath")) {
        explicit.embeddingModelPath = true;
      }
      if (layer.models.reranker && hasOwnProperty(layer.models.reranker, "modelPath")) {
        explicit.rerankerModelPath = true;
      }
    }
  }

  return explicit;
}

function applyDerivedPaths(config: Config, explicit: ExplicitPaths): Config {
  const derived = structuredClone(config) as Config;

  if (!explicit.dbPath) {
    derived.paths.dbPath = path.join(derived.paths.dataDir, "quack.db");
  }

  if (!explicit.vectorIndexPath) {
    derived.paths.vectorIndexPath = path.join(derived.paths.dataDir, "index.hnsw");
  }

  if (!explicit.modelsCacheDir) {
    derived.models.cacheDir = path.join(derived.paths.dataDir, "models");
  }

  return derived;
}

function resolveConfigPaths(config: Config): Config {
  const resolved = structuredClone(config) as Config;

  resolved.paths = {
    dataDir: resolvePath(config.paths.dataDir),
    dbPath: resolvePath(config.paths.dbPath),
    vectorIndexPath: resolvePath(config.paths.vectorIndexPath),
  };

  resolved.models = {
    ...resolved.models,
    cacheDir: resolvePath(config.models.cacheDir),
    embedding: {
      ...resolved.models.embedding,
      modelPath: config.models.embedding.modelPath
        ? resolvePath(config.models.embedding.modelPath)
        : undefined,
    },
    reranker: {
      ...resolved.models.reranker,
      modelPath: config.models.reranker.modelPath
        ? resolvePath(config.models.reranker.modelPath)
        : undefined,
    },
  };

  return resolved;
}

function mergeDeep<T>(base: T, ...sources: Array<Partial<T>>): T {
  let result = structuredClone(base) as T;

  for (const source of sources) {
    result = mergeTwo(result, source);
  }

  return result;
}

function mergeTwo<T>(target: T, source: Partial<T>): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source === undefined ? target : (source as T);
  }

  const output: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const targetValue = (target as Record<string, unknown>)[key];

    if (isPlainObject(value) && isPlainObject(targetValue)) {
      output[key] = mergeTwo(targetValue, value as Record<string, unknown>);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}

function formatConfigAsToml(config: Config, useHomeTilde: boolean): string {
  const sanitized = stripUndefined(config) as Config;
  const prepared = useHomeTilde ? replaceHomePathInConfig(sanitized) : sanitized;

  return toml.stringify(prepared as unknown as toml.JsonMap);
}

function replaceHomePathInConfig(config: Config): Config {
  const homeDir = os.homedir();

  const replacePath = (value: string): string => {
    if (value === homeDir) {
      return "~";
    }

    const withSeparator = homeDir + path.sep;
    if (value.startsWith(withSeparator)) {
      return "~" + value.slice(homeDir.length);
    }

    return value;
  };

  return {
    ...config,
    paths: {
      dataDir: replacePath(config.paths.dataDir),
      dbPath: replacePath(config.paths.dbPath),
      vectorIndexPath: replacePath(config.paths.vectorIndexPath),
    },
    models: {
      ...config.models,
      cacheDir: replacePath(config.models.cacheDir),
      embedding: {
        ...config.models.embedding,
        modelPath: config.models.embedding.modelPath
          ? replacePath(config.models.embedding.modelPath)
          : undefined,
      },
      reranker: {
        ...config.models.reranker,
        modelPath: config.models.reranker.modelPath
          ? replacePath(config.models.reranker.modelPath)
          : undefined,
      },
    },
  };
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item));
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        output[key] = stripUndefined(item);
      }
    }
    return output;
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
