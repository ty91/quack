import { z } from "zod";

const pathsSchema = z
  .object({
    dataDir: z.string().min(1),
    dbPath: z.string().min(1),
    vectorIndexPath: z.string().min(1),
  })
  .strict();

const modelEmbeddingSchema = z
  .object({
    provider: z.string().min(1),
    modelPath: z.string().min(1).optional(),
    modelId: z.string().min(1),
    dimension: z.number().int().positive(),
  })
  .strict();

const modelRerankerSchema = z
  .object({
    provider: z.string().min(1),
    modelPath: z.string().min(1).optional(),
    modelId: z.string().min(1),
  })
  .strict();

const modelsSchema = z
  .object({
    cacheDir: z.string().min(1),
    embedding: modelEmbeddingSchema,
    reranker: modelRerankerSchema,
  })
  .strict();

const searchSchema = z
  .object({
    top: z.number().int().positive(),
    bm25K: z.number().int().positive(),
    vectorK: z.number().int().positive(),
    rerankK: z.number().int().positive(),
    rrfK: z.number().int().positive(),
  })
  .strict();

const chunkingSchema = z
  .object({
    chunkTokens: z.number().int().positive(),
    overlapTokens: z.number().int().min(0),
  })
  .strict();

const providersSchema = z
  .object({
    embedding: z.string().min(1),
    reranker: z.string().min(1),
    mixer: z.string().min(1),
    chunker: z.string().min(1),
  })
  .strict();

export const configSchema = z
  .object({
    paths: pathsSchema,
    models: modelsSchema,
    search: searchSchema,
    chunking: chunkingSchema,
    providers: providersSchema,
  })
  .strict()
  .refine((config) => config.chunking.overlapTokens < config.chunking.chunkTokens, {
    message: "overlapTokens must be less than chunkTokens",
    path: ["chunking", "overlapTokens"],
  });

export type Config = z.infer<typeof configSchema>;
