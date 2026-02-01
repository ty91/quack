import type { SearchResult, SyncSummary } from "../core/types.js";
import type { SourceRecord } from "../storage/types.js";
import type { OutputFormat } from "../config/index.js";

export type SourceStatus = {
  name: string;
  connectorType: string;
  fileCount: number;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastChangedCount: number | null;
};

export function formatSourceList(sources: SourceRecord[], format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(sources, null, 2);
  }

  if (format === "text") {
    return sources
      .map((source) => `${source.name}\t${source.connectorType}\t${source.createdAt}`)
      .join("\n");
  }

  const rows = sources
    .map((source) => `| ${source.name} | ${source.connectorType} | ${source.createdAt} |`)
    .join("\n");
  return `# Sources\n\n| Name | Type | Created |\n| --- | --- | --- |\n${rows}`;
}

export function formatSourceStatus(statuses: SourceStatus[], format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(statuses, null, 2);
  }

  if (format === "text") {
    return statuses
      .map(
        (status) =>
          `${status.name}\tfiles=${status.fileCount}\tlast=${status.lastSyncAt ?? "never"}\tstatus=${status.lastStatus ?? "n/a"}\tchanged=${status.lastChangedCount ?? 0}`,
      )
      .join("\n");
  }

  const rows = statuses
    .map(
      (status) =>
        `| ${status.name} | ${status.fileCount} | ${status.lastSyncAt ?? "never"} | ${status.lastStatus ?? "n/a"} | ${status.lastChangedCount ?? 0} |`,
    )
    .join("\n");
  return `# Source Status\n\n| Name | Files | Last Sync | Status | Changed |\n| --- | --- | --- | --- | --- |\n${rows}`;
}

export function formatSyncSummaries(summaries: SyncSummary[], format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(summaries, null, 2);
  }

  if (format === "text") {
    return summaries
      .map(
        (summary) =>
          `${summary.sourceName}\tscanned=${summary.scannedCount}\tcreated=${summary.createdCount}\tupdated=${summary.updatedCount}\tdeleted=${summary.deletedCount}\tskipped=${summary.skippedCount}\terrors=${summary.errorCount}`,
      )
      .join("\n");
  }

  const rows = summaries
    .map(
      (summary) =>
        `| ${summary.sourceName} | ${summary.scannedCount} | ${summary.createdCount} | ${summary.updatedCount} | ${summary.deletedCount} | ${summary.skippedCount} | ${summary.errorCount} |`,
    )
    .join("\n");

  return `# Sync Summary\n\n| Source | Scanned | Created | Updated | Deleted | Skipped | Errors |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}`;
}

export function formatSearchResults(results: SearchResult[], format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify({ results }, null, 2);
  }

  if (format === "text") {
    return results
      .map(
        (result) =>
          `[${result.rank}] score=${formatScore(result.score)} source=${result.sourceName} path=${result.filePath}\n${result.chunkText}`,
      )
      .join("\n\n");
  }

  const rows = results
    .map(
      (result) =>
        `## ${result.rank}. ${result.sourceName}\n\n- score: ${formatScore(result.score)}\n- path: ${result.filePath}\n\n\`\`\`text\n${result.chunkText}\n\`\`\``,
    )
    .join("\n\n");

  return `# Search Results\n\n${rows}`;
}

export function formatMessage(message: string, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify({ message }, null, 2);
  }

  if (format === "text") {
    return message;
  }

  return `# Result\n\n${message}`;
}

function formatScore(score: number): string {
  return score.toFixed(4);
}
