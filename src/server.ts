import express, { Request, Response, RequestHandler } from 'express';
import { MCPManager } from './mcpManager';
import { loadConfig } from './config';
import { MCPServerConfig } from './types';

const app = express();
app.use(express.json());
const config = loadConfig();
const mcpManager = new MCPManager();
mcpManager.startServers(config.mcpServers);

interface ChatRequestBody {
  prompt: string;
}

const chatHandler: RequestHandler<{}, any, ChatRequestBody> = async (req, res) => {
  const { prompt } = req.body;

  const tools = config.mcpServers.map((server: MCPServerConfig) => ({
    type: 'function',
    function: {
      name: `${server.name}.call`,
      description: `Call a function on the ${server.name} MCP server (e.g., ${server.name === 'filesystem' ? 'writeFile, readFile' : 'launchBrowser, goto'})`,
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', description: `Method to call (e.g., ${server.name === 'filesystem' ? 'writeFile' : 'launchBrowser'})` },
          args: { type: 'object', description: 'Arguments for the method' }
        },
        required: ['method', 'args']
      }
    }
  }));

  const requestBody = {
    model: config.llm.model,
    messages: [{ role: 'user', content: prompt }],
    tools,
    tool_choice: 'auto'
  };
  console.log('Sending to LLM:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${config.llm.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    console.error('LLM request failed:', response.status, response.statusText);
    res.status(500).json({ error: 'LLM request failed', status: response.status });
    return;
  }

  if (!response.body) {
    console.error('No response body from LLM');
    res.status(500).json({ error: 'No response from LLM' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let finalData: any = { message: {} };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    fullResponse += chunk;

    const lines = fullResponse.split('\n');
    fullResponse = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        console.log('Parsed chunk:', JSON.stringify(parsed, null, 2));
        // Merge top-level properties
        finalData = { ...finalData, ...parsed };
        // Merge message object, preserving tool_calls
        if (parsed.message) {
          finalData.message = {
            ...finalData.message,
            ...parsed.message,
            tool_calls: parsed.message.tool_calls || finalData.message.tool_calls // Preserve tool_calls
          };
        }
      } catch (e) {
        console.error('Failed to parse chunk:', e instanceof Error ? e.message : 'Unknown error', 'Raw:', line);
      }
    }
  }

  if (!finalData || !finalData.done) {
    console.error('No final response from LLM');
    res.status(500).json({ error: 'No valid LLM response', raw: fullResponse });
    return;
  }

  console.log('Final LLM response:', JSON.stringify(finalData, null, 2));

  if (finalData.message.tool_calls) {
    const toolCall = finalData.message.tool_calls[0].function;
    const [serverName] = toolCall.name.split('.');
    const result = await mcpManager.callTool(serverName, toolCall.arguments.method, toolCall.arguments.args);
    res.json({ result });
    return;
  }

  res.json({ response: finalData.message.content });
};

app.post('/api/chat', chatHandler);

app.listen(3000, () => console.log('Bridge running on :  http://localhost:3000'));