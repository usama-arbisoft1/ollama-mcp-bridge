import axios from "axios";

export class OllamaClient {
  constructor(private baseUrl: string, private model: string) {}

  async chat(prompt: string, tools: any[]): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/chat`, {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      tools,
      stream: false, // Disable streaming for simpler handling
    });
    return response.data;
  }
}
