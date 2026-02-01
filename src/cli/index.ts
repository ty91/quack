#!/usr/bin/env node
import { Command } from "commander";
import {
  formatConfigOutput,
  getConfigFilePath,
  loadMergedConfig,
  parseOutputFormat,
  writeDefaultConfigFile,
} from "../config/index.js";
import path from "node:path";
import { EmbeddingStore, SearchService, SyncService, type SyncSummary } from "../core/index.js";
import { ConnectorRegistry } from "../connectors/index.js";
import { ProviderRegistry } from "../providers/index.js";
import {
  createChunkDetailsRepository,
  createChunksRepository,
  createEmbeddingsRepository,
  createFilesRepository,
  createFullTextSearchRepository,
  createSourcesRepository,
  createSyncRunsRepository,
  HierarchicalVectorIndex,
  InMemoryVectorIndex,
  openDatabase,
  type VectorIndex,
} from "../storage/index.js";
import { resolvePath } from "../utils/paths.js";
import {
  formatMessage,
  formatSearchResults,
  formatSourceList,
  formatSourceStatus,
  formatSyncSummaries,
  type SourceStatus,
} from "./formatters.js";

type GlobalOptions = {
  config?: string;
  format?: string;
  quiet?: boolean;
  verbose?: boolean;
};

const program = new Command();

program
  .name("quack")
  .description("Local document search CLI")
  .option("--config <path>", "Config file path")
  .option("--format <format>", "Output format (md|text|json)", "md")
  .option("--quiet", "Suppress output")
  .option("--verbose", "Verbose logging");

const configCommand = program.command("config").description("Config commands");

configCommand
  .command("show")
  .description("Show merged config")
  .action(async () => {
    const options = program.opts<GlobalOptions>();
    const format = parseOutputFormat(options.format ?? "md");
    const config = await loadMergedConfig({ configPath: options.config });
    const output = formatConfigOutput(config, format);

    if (!options.quiet) {
      process.stdout.write(ensureTrailingNewline(output));
    }
  });

configCommand
  .command("init")
  .description("Create default config file")
  .action(async () => {
    const options = program.opts<GlobalOptions>();
    const format = parseOutputFormat(options.format ?? "md");
    const configPath = await writeDefaultConfigFile(options.config);

    if (!options.quiet) {
      const output = formatInitOutput(format, configPath);
      process.stdout.write(ensureTrailingNewline(output));
    }
  });

const sourceCommand = program.command("source").description("Source commands");

sourceCommand
  .command("add")
  .description("Register a new source")
  .requiredOption("--path <path>", "Source path")
  .option("--name <string>", "Source name")
  .option("--glob <pattern>", "Include glob pattern")
  .option("--exclude <pattern>", "Exclude glob pattern")
  .action(async (options: { path: string; name?: string; glob?: string; exclude?: string }) => {
    await runAction(async () => {
      const globalOptions = program.opts<GlobalOptions>();
      const format = parseOutputFormat(globalOptions.format ?? "md");
      const config = await loadMergedConfig({ configPath: globalOptions.config });

      const sourcePath = resolvePath(options.path);
      const name = options.name ?? path.basename(sourcePath);

      const message = await withDatabase(config.paths.dbPath, async (database) => {
        const sourcesRepository = createSourcesRepository(database);
        const existing = sourcesRepository.getSourceByName(name);
        if (existing) {
          throw new Error(`Source already exists: ${name}`);
        }

        sourcesRepository.createSource({
          name,
          connectorType: "file-system",
          connectorConfig: {
            rootPath: sourcePath,
            glob: options.glob,
            exclude: options.exclude,
          },
        });

        return `Source added: ${name}`;
      });

      if (!globalOptions.quiet) {
        process.stdout.write(ensureTrailingNewline(formatMessage(message, format)));
      }
    });
  });

sourceCommand
  .command("list")
  .description("List sources")
  .action(async () => {
    await runAction(async () => {
      const globalOptions = program.opts<GlobalOptions>();
      const format = parseOutputFormat(globalOptions.format ?? "md");
      const config = await loadMergedConfig({ configPath: globalOptions.config });

      const sources = await withDatabase(config.paths.dbPath, async (database) => {
        const sourcesRepository = createSourcesRepository(database);
        return sourcesRepository.listSources();
      });

      if (!globalOptions.quiet) {
        process.stdout.write(ensureTrailingNewline(formatSourceList(sources, format)));
      }
    });
  });

sourceCommand
  .command("remove")
  .description("Remove a source")
  .requiredOption("--name <string>", "Source name")
  .option("--purge", "Remove all indexed data")
  .action(async (options: { name: string }) => {
    await runAction(async () => {
      const globalOptions = program.opts<GlobalOptions>();
      const format = parseOutputFormat(globalOptions.format ?? "md");
      const config = await loadMergedConfig({ configPath: globalOptions.config });

      const message = await withDatabase(config.paths.dbPath, async (database) => {
        const sourcesRepository = createSourcesRepository(database);
        const existing = sourcesRepository.getSourceByName(options.name);
        if (!existing) {
          throw new Error(`Source not found: ${options.name}`);
        }

        sourcesRepository.deleteSource(existing.id);
        return `Source removed: ${options.name}`;
      });

      if (!globalOptions.quiet) {
        process.stdout.write(ensureTrailingNewline(formatMessage(message, format)));
      }
    });
  });

sourceCommand
  .command("status")
  .description("Show source status")
  .option("--name <string>", "Source name")
  .action(async (options: { name?: string }) => {
    await runAction(async () => {
      const globalOptions = program.opts<GlobalOptions>();
      const format = parseOutputFormat(globalOptions.format ?? "md");
      const config = await loadMergedConfig({ configPath: globalOptions.config });

      const statuses = await withDatabase(config.paths.dbPath, async (database) => {
        const sourcesRepository = createSourcesRepository(database);
        const filesRepository = createFilesRepository(database);
        const syncRunsRepository = createSyncRunsRepository(database);

        const namedSource = options.name ? sourcesRepository.getSourceByName(options.name) : null;
        const sources = options.name
          ? namedSource
            ? [namedSource]
            : []
          : sourcesRepository.listSources();

        if (options.name && sources.length === 0) {
          throw new Error(`Source not found: ${options.name}`);
        }

        return sources.map<SourceStatus>((source) => {
          const latestSync = syncRunsRepository.getLatestSyncRun(source.id);
          return {
            name: source.name,
            connectorType: source.connectorType,
            fileCount: filesRepository.countFilesBySource(source.id),
            lastSyncAt: latestSync?.endedAt ?? null,
            lastStatus: latestSync?.status ?? null,
            lastChangedCount: latestSync?.changedCount ?? null,
          };
        });
      });

      if (!globalOptions.quiet) {
        process.stdout.write(ensureTrailingNewline(formatSourceStatus(statuses, format)));
      }
    });
  });

sourceCommand
  .command("sync")
  .description("Sync sources")
  .option("--name <string>", "Source name")
  .option("--all", "Sync all sources")
  .action(async (options: { name?: string; all?: boolean }) => {
    await runAction(async () => {
      const globalOptions = program.opts<GlobalOptions>();
      const format = parseOutputFormat(globalOptions.format ?? "md");
      const config = await loadMergedConfig({ configPath: globalOptions.config });

      const summaries = await withDatabase(config.paths.dbPath, async (database) => {
        const sourcesRepository = createSourcesRepository(database);
        const filesRepository = createFilesRepository(database);
        const chunksRepository = createChunksRepository(database);
        const embeddingsRepository = createEmbeddingsRepository(database);
        const syncRunsRepository = createSyncRunsRepository(database);

        const connectorRegistry = new ConnectorRegistry();
        const providers = new ProviderRegistry({ config });
        const chunker = providers.getChunker();
        const embeddingProvider = providers.getEmbeddingProvider();
        const vectorIndex = await openVectorIndex(config, "sync");
        const embeddingStore = new EmbeddingStore({
          embeddingsRepository,
          vectorIndex,
        });
        const syncService = new SyncService({
          connectorRegistry,
          sourcesRepository,
          filesRepository,
          chunksRepository,
          embeddingsRepository,
          syncRunsRepository,
          chunker,
          embeddingProvider,
          embeddingStore,
          embeddingModelName: config.models.embedding.modelId,
          embeddingDimension: config.models.embedding.dimension,
        });

        const namedSource = options.name ? sourcesRepository.getSourceByName(options.name) : null;
        const sources = options.all
          ? sourcesRepository.listSources()
          : options.name
            ? namedSource
              ? [namedSource]
              : []
            : [];

        if (sources.length === 0) {
          if (options.name) {
            throw new Error(`Source not found: ${options.name}`);
          }
          throw new Error("No sources selected. Use --name or --all.");
        }

        try {
          const summaries: SyncSummary[] = [];
          for (const source of sources) {
            const summary = await syncService.syncSource(source.id);
            summaries.push(summary);
          }

          await vectorIndex.save();
          return summaries;
        } finally {
          vectorIndex.close();
        }
      });

      if (!globalOptions.quiet) {
        process.stdout.write(ensureTrailingNewline(formatSyncSummaries(summaries, format)));
      }
    });
  });

program
  .command("search")
  .description("Search documents")
  .requiredOption("--query <string>", "Search query")
  .option("--top <n>", "Top results")
  .option("--bm25 <n>", "BM25 candidate count")
  .option("--vector <n>", "Vector candidate count")
  .option("--rerank <n>", "Rerank candidate count")
  .action(
    async (options: {
      query: string;
      top?: string;
      bm25?: string;
      vector?: string;
      rerank?: string;
    }) => {
      await runAction(async () => {
        const globalOptions = program.opts<GlobalOptions>();
        const format = parseOutputFormat(globalOptions.format ?? "md");
        const config = await loadMergedConfig({ configPath: globalOptions.config });

        const top = parseIntegerOption(options.top) ?? config.search.top;
        const bm25K = parseIntegerOption(options.bm25) ?? config.search.bm25K;
        const vectorK = parseIntegerOption(options.vector) ?? config.search.vectorK;
        const rerankK = parseIntegerOption(options.rerank) ?? config.search.rerankK;

        const results = await withDatabase(config.paths.dbPath, async (database) => {
          const fullTextSearchRepository = createFullTextSearchRepository(database);
          const embeddingsRepository = createEmbeddingsRepository(database);
          const chunkDetailsRepository = createChunkDetailsRepository(database);
          const vectorIndex = await openVectorIndex(config, "search");
          const providers = new ProviderRegistry({ config });
          const embeddingProvider = providers.getEmbeddingProvider();
          const mixer = providers.getMixer();
          const reranker = providers.getRerankerProvider();

          const searchService = new SearchService({
            fullTextSearchRepository,
            embeddingsRepository,
            chunkDetailsRepository,
            vectorIndex,
            embeddingProvider,
            mixer,
            reranker,
          });

          try {
            return await searchService.search({
              query: options.query,
              top,
              bm25K,
              vectorK,
              rerankK,
              modelName: config.models.embedding.modelId,
            });
          } finally {
            vectorIndex.close();
          }
        });

        if (!globalOptions.quiet) {
          process.stdout.write(ensureTrailingNewline(formatSearchResults(results, format)));
        }
      });
    },
  );

await program.parseAsync(process.argv);

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function formatInitOutput(format: string, configPath: string): string {
  if (format === "json") {
    return JSON.stringify({ configPath }, null, 2);
  }

  if (format === "text") {
    return `Config created: ${configPath}`;
  }

  const resolvedPath = getConfigFilePath(configPath);
  return `# Config\n\nCreated: ${resolvedPath}`;
}

async function withDatabase<T>(
  databasePath: string,
  action: (database: Awaited<ReturnType<typeof openDatabase>>) => Promise<T>,
): Promise<T> {
  const database = await openDatabase({ databasePath });
  try {
    return await action(database);
  } finally {
    database.close();
  }
}

function parseIntegerOption(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function openVectorIndex(
  config: Awaited<ReturnType<typeof loadMergedConfig>>,
  purpose: "sync" | "search",
): Promise<VectorIndex> {
  try {
    return await HierarchicalVectorIndex.open({
      indexPath: config.paths.vectorIndexPath,
      dimension: config.models.embedding.dimension,
      maxElements: 100000,
      searchEffort: purpose === "search" ? Math.max(config.search.vectorK, 50) : undefined,
    });
  } catch (error) {
    if (isMissingNativeBinding(error)) {
      console.warn("HNSW native binding unavailable. Falling back to in-memory index.");
      return new InMemoryVectorIndex();
    }
    throw error;
  }
}

function isMissingNativeBinding(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("Could not locate the bindings file");
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message) {
      process.stderr.write(ensureTrailingNewline(message));
    }
    process.exitCode = 1;
  }
}
