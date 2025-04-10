import { MCPManager } from "./mcpManager";
import { OllamaClient } from "./ollamaClient";
import { Config } from "./types";

export class Bridge {
  private mcpManager: MCPManager;
  private ollamaClient: OllamaClient;

  constructor(config: Config) {
    this.mcpManager = new MCPManager();
    this.ollamaClient = new OllamaClient(config.llm.baseUrl, config.llm.model);
    this.mcpManager.startServers(config.mcpServers);
  }

  async handlePrompt(prompt: string): Promise<string> {
    const tools = Array.from(this.mcpManager["processes"].keys()).map(
      (name) => ({
        type: "function",
        function: {
          name: `${name}.call`,
          description: `Call a function on the ${name} MCP server`,
          parameters: {
            type: "object",
            properties: {
              method: {
                type: "string",
                description: "The method to call (e.g., writeFile)",
              },
              args: {
                type: "object",
                description:
                  "Arguments for the method (e.g., { filename: string, content: string })",
              },
            },
            required: ["method", "args"],
          },
        },
      })
    );

    console.log("Sending prompt to LLM:", prompt);
    console.log("Available tools:", JSON.stringify(tools, null, 2));

    const response = await this.ollamaClient.chat(prompt, tools);
    console.log("LLM response:", JSON.stringify(response, null, 2));

    // Handle Ollama's multi-line response format
    let toolCall = null;
    if (typeof response === "string") {
      const lines = response.trim().split("\n");
      for (const line of lines) {
        const parsed = JSON.parse(line);
        if (parsed.message?.tool_calls) {
          toolCall = parsed.message.tool_calls[0];
          break;
        }
      }
    } else if (response.message?.tool_calls) {
      toolCall = response.message.tool_calls[0];
    }

    if (toolCall) {
      console.log("Tool call detected:", JSON.stringify(toolCall, null, 2));
      const [serverName, _] = toolCall.function.name.split(".");
      const { method, args } = toolCall.function.arguments;
      const result = await this.mcpManager.callTool(serverName, method, args);
      console.log("Tool call result:", result);
      return JSON.stringify(result);
    }
    console.log("No tool call, returning raw response");
    return response.message?.content || "No response";
  }
}
