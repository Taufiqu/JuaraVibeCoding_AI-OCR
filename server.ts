import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Local storage for extraction history
const HISTORY_FILE = path.join(process.cwd(), "extraction_history.json");

interface HistoryItem {
  id: string;
  filename: string;
  doc_type: string;
  extracted_data: Record<string, any>;
  user_prompt: string | null;
  confidence: string;
  created_at: string;
}

// Ensure database file exists
function readHistory(): HistoryItem[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const data = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read history:", err);
    return [];
  }
}

function writeHistory(history: HistoryItem[]) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write history:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request limits increased for PDF/image payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Process Document using Gemini 1.5/3.5
  app.post("/api/process", async (req, res) => {
    try {
      const { fileData, mimeType, fileName, prompt } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: "Missing fileData (base64 string)." });
      }
      if (!mimeType) {
        return res.status(400).json({ error: "Missing mimeType specification." });
      }

      // Check key lazily to prevent server startup crashes if not configured
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is not defined in the workspace secrets. Please configure it in Settings > Secrets.",
          isMissingKey: true
        });
      }

      // Initialize GenAI
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // System instruction dictating strict output validation
      const systemInstruction = 
        "You are a state-of-the-art document processing AI. Your goal is to analyze documents " +
        "(Invoices, Receipts, Tax Slips, National IDs, Medical Reports, etc.) and extract " +
        "their information cleanly and accurately.\n\n" +
        "You MUST return a valid, parsable JSON object with EXACTLY three top-level keys:\n" +
        "1. 'document_type': A string naming the classification of the document.\n" +
        "2. 'extracted_data': A JSON object (key-value dictionary) holding all extracted data values. Make keys descriptive.\n" +
        "3. 'confidence': A string evaluation ('High', 'Medium', or 'Low') indicating accuracy.\n\n" +
        "Strict Rule: Return ONLY raw JSON. No markdown backticks, no markdown codeblocks, and no pre-ambles.";

      // Deciding instruction based on mode
      const targetInstruction = prompt?.trim()
        ? `The user has requested custom extraction: "${prompt}". Please extract data conforming directly to this parameter. Populate descriptive nested keys within the 'extracted_data' object for requested values.`
        : "Analyze this document automatically. Locate critical transaction dates, names, reference numbers, line items, and totals. Map them inside the 'extracted_data' block.";

      // Prepare payload inline data
      const inlinePart = {
        inlineData: {
          mimeType: mimeType,
          data: fileData, // Base64 string
        },
      };

      // Query Gemini
      // Recommended model for general text/multimodal JSON extraction
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [inlinePart, targetInstruction],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          // Structured schema
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              document_type: { type: Type.STRING },
              extracted_data: { type: Type.OBJECT }, // Will hold arbitrary dynamic key-values
              confidence: { type: Type.STRING },
            },
            required: ["document_type", "extracted_data", "confidence"],
          },
        },
      });

      const responseText = geminiResponse.text;
      if (!responseText) {
        throw new Error("Empty response received from the Gemini model.");
      }

      // Process reply
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText.trim());
      } catch (e) {
        // Fallback cleanup
        let cleanText = responseText.trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.replace("```json", "");
        }
        if (cleanText.endsWith("```")) {
          cleanText = cleanText.slice(0, -3);
        }
        parsedResult = JSON.parse(cleanText.trim());
      }

      // Populate into SQL database simulator file
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        filename: fileName || "unnamed_document",
        doc_type: parsedResult.document_type || "Unknown Document",
        extracted_data: parsedResult.extracted_data || {},
        user_prompt: prompt?.trim() || null,
        confidence: parsedResult.confidence || "Medium",
        created_at: new Date().toISOString(),
      };

      const currentHistory = readHistory();
      currentHistory.unshift(newItem); // prepending
      writeHistory(currentHistory);

      return res.status(200).json({ success: true, item: newItem });

    } catch (error: any) {
      console.error("Processing API crash:", error);
      return res.status(500).json({
        error: "Document processing failed.",
        details: error.message || String(error),
      });
    }
  });

  // API Route: Get History Logs
  app.get("/api/history", (req, res) => {
    try {
      const list = readHistory();
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to read history log", details: err.message });
    }
  });

  // API Route: Delete History Item
  app.delete("/api/history/:id", (req, res) => {
    try {
      const { id } = req.params;
      const list = readHistory();
      const filtered = list.filter((item) => item.id !== id);
      writeHistory(filtered);
      return res.json({ success: true, message: `Successfully deleted log: ${id}.` });
    } catch (err: any) {
      return res.status(500).json({ error: "Deletion failed.", details: err.message });
    }
  });

  // Serve static UI assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Development Server booted and routed on port ${PORT}`);
  });
}

startServer();
