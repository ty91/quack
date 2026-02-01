import { FileSystemConnector } from "./file-system.js";
import type { Connector, ConnectorType, Source } from "./types.js";

type ConnectorFactory = (source: Source) => Connector;

type ConnectorRegistryOptions = {
  connectorFactories?: Partial<Record<ConnectorType, ConnectorFactory>>;
};

export class ConnectorRegistry {
  private readonly connectorFactories: Record<ConnectorType, ConnectorFactory>;
  private readonly fileSystemConnector = new FileSystemConnector();

  constructor(options: ConnectorRegistryOptions = {}) {
    this.connectorFactories = {
      "file-system": () => this.fileSystemConnector,
      bear: () => {
        throw new Error("Bear connector not implemented");
      },
      obsidian: () => {
        throw new Error("Obsidian connector not implemented");
      },
      ...options.connectorFactories,
    };
  }

  getConnector(source: Source): Connector {
    const factory = this.connectorFactories[source.connectorType];
    if (!factory) {
      throw new Error(`Unsupported connector type: ${source.connectorType}`);
    }
    return factory(source);
  }

  listConnectorTypes(): ConnectorType[] {
    return Object.keys(this.connectorFactories) as ConnectorType[];
  }
}
