import { spawn, ChildProcess } from "child_process";
import { MCPServerConfig } from "./types";
import { join } from "path";

export class MCPManager {
  private processes: Map<string, ChildProcess> = new Map();

  startServers(servers: MCPServerConfig[]) {
    for (const server of servers) {
      let proc: ChildProcess;

      if (server.name === "filesystem") {
        // Use custom simple-filesystem.js for filesystem server
        const scriptPath = join(__dirname, "../simple-filesystem.js");
        proc = spawn("node", [scriptPath], { stdio: "pipe" });
      } else {
        // Fallback for other servers (can expand this later)
        console.warn(
          `No implementation for server: ${server.name}. Skipping or using default behavior.`
        );
        continue; // Skip unsupported servers for now
      }

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

      const onData = (data: Buffer) => {
        const responseStr = data.toString().trim();
        console.log(`${serverName} raw response:`, responseStr);
        try {
          const response = JSON.parse(responseStr);
          console.log(`${serverName} parsed response:`, response);
          proc.stdout?.off("data", onData);
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
      };

      proc.stdout.on("data", onData);

      proc.stderr?.on("data", (data) => {
        console.error(`${serverName} error:`, data.toString());
        reject(new Error(`${serverName} error: ${data.toString()}`));
      });

      setTimeout(() => {
        proc.stdout?.off("data", onData);
        reject(new Error(`${serverName} timed out`));
      }, 5000);
    });
  }
}
