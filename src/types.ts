export interface MCPServerConfig {
  name: string;
  allowedDirectory?: string;
}

export interface Config {
  mcpServers: MCPServerConfig[];
  llm: {
    model: string;
    baseUrl: string;
  };
}
