export type ConnectorType = "file-system" | "bear" | "obsidian";

export type FileSystemConnectorConfig = {
  rootPath: string;
  glob?: string;
  exclude?: string;
};

export type BearConnectorConfig = {
  databasePath: string;
};

export type ObsidianConnectorConfig = {
  vaultPath: string;
};

export type ConnectorConfig =
  | FileSystemConnectorConfig
  | BearConnectorConfig
  | ObsidianConnectorConfig;

export type Source = {
  id: number;
  name: string;
  connectorType: ConnectorType;
  connectorConfig: ConnectorConfig;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRef = {
  sourceId: number;
  path: string;
  absolutePath?: string;
  externalId?: string;
};

export type DocumentMetadata = {
  mtime: number;
  size: number;
  hash: string;
};

export type Connector = {
  listDocuments: (source: Source) => Promise<DocumentRef[]>;
  readDocument: (document: DocumentRef) => Promise<string>;
  getDocumentMetadata: (document: DocumentRef) => Promise<DocumentMetadata>;
};
