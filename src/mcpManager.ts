import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig } from './types';
import { join } from 'path';

export class MCPManager {
  private processes: Map<string, ChildProcess> = new Map();

  startServers(servers: MCPServerConfig[]) {
    for (const server of servers) {
      const { name, command = 'npx', args = [], allowedDirectory } = server;
      let proc: ChildProcess;

      // Handle backward compatibility
      const effectiveArgs = args.length > 0 
        ? args 
        : [`@modelcontextprotocol/server-${name}`, allowedDirectory || './'];

      try {
        console.log(`Starting ${name} with command: ${command} ${effectiveArgs.join(' ')}`);
        proc = spawn(command, effectiveArgs, { stdio: 'pipe', shell: true });
      } catch (e) {
        console.error(`Failed to start ${name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        // Fallback to custom script if exists
        const customScript = join(__dirname, `../simple-${name}.js`);
        console.log(`Trying fallback: node ${customScript} ${allowedDirectory || './'}`);
        proc = spawn('node', [customScript, allowedDirectory || './'], { stdio: 'pipe' });
      }

      this.processes.set(name, proc);

      proc.stdout?.on('data', (data) => console.log(`${name}: ${data}`));
      proc.stderr?.on('data', (data) => console.error(`${name}: ${data}`));
      proc.on('close', (code) => console.log(`${name} exited with code ${code}`));
    }
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const proc = this.processes.get(serverName);
    if (!proc) throw new Error(`Server ${serverName} not running`);

    const request = JSON.stringify({ method: toolName, params: args, id: 1 });
    console.log(`Sending to ${serverName}:`, request);

    return new Promise((resolve, reject) => {
      if (!proc.stdin || !proc.stdout) {
        return reject(new Error(`${serverName} process has no stdin/stdout`));
      }

      proc.stdin.write(request + '\n');
      console.log(`${serverName}: Command sent`);

      const onData = (data: Buffer) => {
        const responseStr = data.toString().trim();
        console.log(`${serverName} raw response:`, responseStr);
        try {
          const response = JSON.parse(responseStr);
          console.log(`${serverName} parsed response:`, response);
          proc.stdout!.off('data', onData);
          resolve(response.result || response);
        } catch (e) {
          reject(new Error(`Failed to parse ${serverName} response: ${e instanceof Error ? e.message : 'Unknown error'}`));
        }
      };

      proc.stdout.on('data', onData);

      proc.stderr?.on('data', (data) => console.error(`${serverName}: ${data}`));
      proc.on('error', (err) => reject(err));

      setTimeout(() => {
        proc.stdout!.off('data', onData);
        reject(new Error(`${serverName} timed out`));
      }, 5000);
    });
  }
}