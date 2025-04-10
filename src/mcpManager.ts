import { spawn, ChildProcess } from "child_process";
import { MCPServerConfig } from "./types";

export class MCPManager {
  private processes: Map<string, ChildProcess> = new Map();

  startServers(servers: MCPServerConfig[]) {
    for (const server of servers) {
      const args = [`@modelcontextprotocol/server-${server.name}`];
      const directory = server.allowedDirectory || "./";
      args.push(directory);

      const proc = spawn("npx", args, { stdio: "pipe" });
      this.processes.set(server.name, proc);

      proc.stdout?.on("data", (data) => console.log(`${server.name}: ${data}`));
      proc.stderr?.on("data", (data) =>
        console.error(`${server.name}: ${data}`)
      );
      proc.on("close", (code) =>
        console.log(`${server.name} exited with code ${code}`)
      );
    }
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const proc = this.processes.get(serverName);
    if (!proc) throw new Error(`Server ${serverName} not running`);

    const request = JSON.stringify({ method: toolName, params: args, id: 1 });
    console.log(`Sending to ${serverName}:`, request);

    return new Promise((resolve, reject) => {
      if (!proc.stdin || !proc.stdout) {
        return reject(new Error(`${serverName} process has no stdin/stdout`));
      }

      proc.stdin.write(request + "\n");
      console.log(`${serverName}: Command sent`);

      proc.stdout.once("data", (data) => {
        console.log(`${serverName} raw response:`, data.toString());
        try {
          const response = JSON.parse(data.toString());
          console.log(`${serverName} parsed response:`, response);
          resolve(response.result || response);
        } catch (e) {
          reject(
            new Error(
              `Failed to parse ${serverName} response: ${
                e instanceof Error ? e.message : String(e)
              }`
            )
          );
        }
      });

      proc.stderr?.once("data", (data) => {
        console.error(`${serverName} error:`, data.toString());
        reject(new Error(`${serverName} error: ${data.toString()}`));
      });

      // Timeout after 5 seconds to avoid hanging
      setTimeout(() => reject(new Error(`${serverName} timed out`)), 5000);
    });
  }
}
