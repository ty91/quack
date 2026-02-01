#!/usr/bin/env node
import { Command } from "commander";
import {
  formatConfigOutput,
  getConfigFilePath,
  loadMergedConfig,
  parseOutputFormat,
  writeDefaultConfigFile
} from "../config/index.js";

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
