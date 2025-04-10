import express from "express";
import { Bridge } from "./bridge";
import * as fs from "fs";

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
const bridge = new Bridge(config);

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  console.log("Received request:", req.body);
  const { prompt } = req.body;
  try {
    const result = await bridge.handlePrompt(prompt);
    console.log("Sending response:", result);
    res.json({ result });
  } catch (error) {
    console.error("Error:", error); // Log any errors
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(3000, () => console.log("Bridge running at http://localhost:3000"));
