const fs = require('fs').promises;
const path = require('path');

process.stdin.on('data', async (data) => {
  try {
    const { method, params, id } = JSON.parse(data.toString().trim());
    console.error('Received:', data.toString().trim()); // Debug to stderr
    if (method === 'writeFile') {
      const filePath = path.join('/Users/usama.jalal/ollama-mcp-bridge/workspace', params.filename);
      await fs.writeFile(filePath, params.content);
      console.log(JSON.stringify({ id, result: 'File written successfully' }));
    } else {
      console.log(JSON.stringify({ id, error: `Unknown method: ${method}` }));
    }
  } catch (e) {
    console.error(JSON.stringify({ id, error: e.message }));
  }
});

console.log('Simple Filesystem Server running on stdio');