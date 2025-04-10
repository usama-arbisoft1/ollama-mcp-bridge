export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[]; 
  allowedDirectory?: string;
}

export interface LLMConfig {
  model: string;
  baseUrl: string;
}

export interface Config {
  mcpServers: MCPServerConfig[];
  llm: LLMConfig;
}