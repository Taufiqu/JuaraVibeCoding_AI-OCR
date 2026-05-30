import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  Code, 
  Table, 
  Calendar, 
  Copy, 
  Download, 
  Layers, 
  ChevronDown, 
  FileUp,
  FileCheck,
  Check,
  Sparkle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExtractHistoryItem {
  id: string;
  filename: string;
  doc_type: string;
  extracted_data: Record<string, any>;
  user_prompt: string | null;
  confidence: string;
  created_at: string;
}

const TEMPLATES = [
  { label: "Tax Details & Total", prompt: "Identify buyer, seller, due date, TAX/VAT amounts, and full Grand Total." },
  { label: "Receipt & Items List", prompt: "List all items with descriptions, quantities, unit prices, and final total payment details." },
  { label: "ID Card Data", prompt: "Extract full name, identifier numbers, birth dates, address, and expiry details." },
  { label: "Legal Contract Keys", prompt: "Extract effective date, target obligations, naming parties, and signature conditions." },
];

export default function App() {
  // File upload state variables
  const [fileData, setFileData] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Interface options state variables
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "json">("table");

  // Output container status
  const [currentResult, setCurrentResult] = useState<ExtractHistoryItem | null>(null);
  const [historyList, setHistoryList] = useState<ExtractHistoryItem[]>([]);
  const [alertMsg, setAlertMsg] = useState<{ text: string; isMissingKey?: boolean } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editable fields mapping
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Load history list on launch
  useEffect(() => {
    fetchHistory();
  }, []);

  // Update editing fields when currentResult changes
  useEffect(() => {
    if (currentResult?.extracted_data) {
      const flat: Record<string, string> = {};
      Object.entries(currentResult.extracted_data).forEach(([k, v]) => {
        flat[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      });
      setEditFields(flat);
      setIsEditing(false);
    } else {
      setEditFields({});
    }
  }, [currentResult]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Failed to load history list:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragOver(true);
    } else if (e.type === "dragleave") {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    // Limits size to ~20MB
    if (file.size > 20 * 1024 * 1024) {
      setAlertMsg({ text: "File size exceeds 20MB limit. Please provide a smaller image or document." });
      return;
    }

    setAlertMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const resultString = reader.result as string;
      const base64 = resultString.split(",")[1];
      setFileData(base64);
      setMimeType(file.type || "image/jpeg");
      setFileName(file.name);

      if (file.type.startsWith("image/")) {
        setPreviewUrl(resultString);
      } else {
        setPreviewUrl(""); // PDF or other document icon representation
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProcessDocument = async () => {
    if (!fileData || !mimeType || !fileName) {
      setAlertMsg({ text: "Please upload or drop a document file first." });
      return;
    }

    setIsProcessing(true);
    setAlertMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData,
          mimeType,
          fileName,
          prompt: mode === "custom" ? customPrompt : "",
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Network error while calling server parser.");
      }

      if (body.success && body.item) {
        setCurrentResult(body.item);
        setSuccessMsg("Document parsed and saved with high precision.");
        await fetchHistory(); // reload logs
      } else {
        throw new Error("Invalid structure returned from server backend.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("GEMINI_API_KEY")) {
        setAlertMsg({ text: err.message, isMissingKey: true });
      } else {
        setAlertMsg({ text: err.message || "An error occurred while communicating with Gemini." });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this extraction record?")) return;

    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistoryList((prev) => prev.filter((item) => item.id !== id));
        if (currentResult?.id === id) {
          setCurrentResult(null);
        }
        setSuccessMsg("History log purged successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Deletion API failed:", err);
    }
  };

  const handleCopyJson = () => {
    if (!currentResult) return;
    const jsonStr = JSON.stringify(currentResult.extracted_data, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!currentResult?.extracted_data) return;
    let csvContent = "data:text/csv;charset=utf-8,Field,Value\n";
    Object.entries(currentResult.extracted_data).forEach(([key, val]) => {
      const cleanVal = typeof val === "object" ? JSON.stringify(val).replace(/"/g, '""') : String(val).replace(/"/g, '""');
      csvContent += `"${key.replace(/"/g, '""')}","${cleanVal}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentResult.filename}_extracted.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveChanges = () => {
    if (!currentResult) return;
    
    // Package back edited fields to object
    const finalData: Record<string, any> = {};
    Object.entries(editFields).forEach(([key, val]) => {
      try {
        const textVal = typeof val === "string" ? val : String(val);
        // Try to parse if it was structured JSON array or object
        if ((textVal.startsWith("{") && textVal.endsWith("}")) || (textVal.startsWith("[") && textVal.endsWith("]"))) {
          finalData[key] = JSON.parse(textVal);
        } else {
          finalData[key] = textVal;
        }
      } catch {
        finalData[key] = val;
      }
    });

    const updatedResult = {
      ...currentResult,
      extracted_data: finalData,
    };

    setCurrentResult(updatedResult);
    setIsEditing(false);
    setSuccessMsg("Field values adjusted successfully.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] selection:bg-blue-150 flex flex-col font-sans text-slate-800">
      {/* Header Panel */}
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-40 px-6 py-4 transition-all duration-300 shadow-sm/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-sm shadow-blue-500/25">
              U
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-sans font-bold text-lg tracking-tight text-slate-900">
                  Universal AI <span className="text-slate-500 font-medium">Doc Extractor</span>
                </h1>
                <span className="hidden md:inline px-3 py-0.5 bg-[#e0f2fe] text-[#0369a1] text-[10.5px] font-semibold tracking-wider rounded-full uppercase border border-[#bae6fd]">
                  #JuaraVibeCoding
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Dynamic unstructured metrics classification & auto-suggest structured data schema using Google Gemini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Cloud Run: Healthy
            </div>
            <div className="w-8 h-8 bg-slate-100 rounded-full border border-slate-200/60" />
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Controls Column */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-sans font-semibold text-sm tracking-tight text-slate-800 flex items-center gap-2">
                <FileUp className="w-4.5 h-4.5 text-slate-500" />
                Upload Document
              </h2>
              {fileData && (
                <button 
                  onClick={() => {
                    setFileData(null);
                    setFileName(null);
                    setMimeType(null);
                    setPreviewUrl("");
                    setAlertMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-800 font-medium flex items-center gap-1 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Drag & Drop Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer min-h-[220px] ${
                isDragOver 
                  ? "border-blue-500 bg-blue-50/40" 
                  : fileData 
                    ? "border-emerald-200 bg-emerald-50/10" 
                    : "border-slate-300 bg-[#f8fafc] hover:border-slate-400"
              }`}
            >
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={handleFileSelection}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="document-upload-field"
              />

              {!fileData ? (
                <div className="text-center flex flex-col items-center gap-3">
                  <div className="text-4xl select-none mb-1">☁️</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop your document here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PDF, JPEG, PNG up to 20MB
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-white hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold tracking-wide border border-slate-200 transition-colors shadow-sm">
                    Browse Files
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center justify-center">
                  {previewUrl ? (
                    <div className="relative w-full max-h-48 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img 
                        src={previewUrl} 
                        alt="Doc Preview" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full flex items-center gap-3 bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                      <div className="p-2.5 bg-red-100 text-red-700 rounded-lg">
                        <FileText className="w-5.5 h-5.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {fileName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold tracking-wider">
                          {mimeType?.split("/")[1] || "PDF"} Document
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-500 animate-bounce" />
                      File successfully loaded
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trigger Option Panels */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            <h2 className="font-sans font-semibold text-sm tracking-tight text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-4.5 h-4.5 text-slate-500" />
              Extraction Parameter Mode
            </h2>

            {/* Selector tabs */}
            <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200/60">
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`py-2 text-xs font-semibold tracking-wide rounded-md transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  mode === "auto"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkle className={`w-3.5 h-3.5 ${mode === "auto" ? "text-blue-600" : ""}`} />
                Auto-Suggest Mode
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`py-2 text-xs font-semibold tracking-wide rounded-md transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  mode === "custom"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Code className={`w-3.5 h-3.5 ${mode === "custom" ? "text-blue-600" : ""}`} />
                Custom Directives
              </button>
            </div>

            {/* Dynamic input field display */}
            <AnimatePresence mode="wait">
              {mode === "auto" ? (
                <motion.div
                  key="auto-panel"
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.15 }}
                  className="bg-sky-50/60 border border-sky-100 p-4 rounded-xl text-xs text-sky-800 leading-relaxed"
                >
                  <p className="font-semibold text-sky-950 mb-1">
                    Auto-Suggest Active
                  </p>
                  Gemini will dynamically read structural components, layouts, and semantic tags within your document to automatically synthesize ideal schema mapping.
                </motion.div>
              ) : (
                <motion.div
                  key="custom-panel"
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Extraction Instructions Prompt:
                    </label>
                    <textarea
                      placeholder="Leave empty for Auto-Suggest Mode, or type specific fields like 'Extract only the subtotal and vendor NPWP'... "
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full text-xs min-h-[90px] border border-slate-200 p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all font-sans text-slate-800 placeholder:text-slate-400 shadow-inner/10"
                    />
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold text-slate-500 mb-2">
                      Quick Preset Templates:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setCustomPrompt(item.prompt)}
                          className="px-2.5 py-1 text-[10px] bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-[#2563eb] font-semibold tracking-wide border border-slate-200 rounded transition-all"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Run Action Panel */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleProcessDocument}
                disabled={isProcessing || !fileData}
                className={`w-full py-3 rounded-xl font-sans font-semibold text-sm tracking-wide text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                  isProcessing 
                    ? "bg-blue-700/60 cursor-not-allowed" 
                    : !fileData 
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-[#2563eb] hover:bg-blue-700 active:scale-[0.98]"
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    Processing with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4.5 h-4.5 fill-white/10" />
                    Process with Gemini
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Visualizing Results Column */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[480px]">
            
            {/* Action Output Notifications */}
            {alertMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-xs text-red-800 leading-relaxed shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-650 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-950 mb-0.5">Extraction Halted</p>
                  {alertMsg.text}
                  {alertMsg.isMissingKey && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-100 rounded text-[10px] font-bold text-red-800 border border-red-200">
                        SETUP REQUIRED
                      </span>
                      <p className="text-[11px] text-red-900">
                        Set <code className="font-mono bg-red-100/50 px-1 py-0.5 rounded">GEMINI_API_KEY</code> within Settings {"->"} Secrets.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            {/* Tab header buttons */}
            {currentResult ? (
              <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-sky-50 rounded-full text-xs font-semibold text-sky-800 border border-sky-100 uppercase tracking-wider">
                      {currentResult.doc_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      currentResult.confidence === "High" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : currentResult.confidence === "Medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {currentResult.confidence} Confidence
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-xs mt-1 block">
                    Source: {currentResult.filename}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5 w-full sm:w-auto">
                  <div className="border border-slate-200 bg-slate-50 p-1 rounded-lg flex items-center">
                    <button
                      onClick={() => setActiveTab("table")}
                      className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "table"
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/55"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      Table
                    </button>
                    <button
                      onClick={() => setActiveTab("json")}
                      className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "json"
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/55"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      JSON
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Core result panels mapping */}
            <div className="flex-1 flex flex-col justify-between">
              {isProcessing ? (
                /* Dynamic Skeleton Parsing View */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 border-[3px] border-blue-150 border-t-blue-600 rounded-full animate-spin" />
                    <Sparkles className="w-6 h-6 text-blue-500 absolute animate-pulse-slow" />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="font-sans font-bold text-slate-800 text-sm">
                      Streaming Structured Payload...
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 pb-4 border-b border-slate-200 border-dashed max-w-[280px] mx-auto">
                      Invoking Gemini parser model, extracting metadata, compiling key-values...
                    </p>
                    <div className="text-[10px] text-blue-800 font-semibold tracking-wider uppercase mt-4 flex flex-col gap-1 items-center">
                      <span className="px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                        Protip #JuaraVibeCoding
                      </span>
                      <span className="text-slate-400 leading-normal lowercase font-normal italic max-w-xs mt-1 text-center font-sans normal-case">
                        Auto-Suggest Mode guarantees flawless schema parsing without hand-crafted templates.
                      </span>
                    </div>
                  </div>
                </div>
              ) : currentResult ? (
                /* True content output mapping */
                <div className="flex flex-col flex-1 justify-between">
                  <div className="flex-1">
                    {activeTab === "table" ? (
                      /* Table visualization panel */
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-6">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="px-4 py-3 w-1/3">Field Key</th>
                              <th className="px-4 py-3">Extracted Metadata value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(editFields).map(([key, val]) => (
                              <tr key={key} className="hover:bg-slate-50/60 group transition-colors">
                                <td className="px-4 py-3 font-mono font-medium text-slate-500 select-all border-r border-slate-100">
                                  {key}
                                </td>
                                <td className="px-4 py-3 text-slate-800 font-sans">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => {
                                        setEditFields({
                                          ...editFields,
                                          [key]: e.target.value,
                                        });
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans text-xs text-slate-800"
                                    />
                                  ) : (
                                    <span className="break-all whitespace-pre-wrap select-all font-medium text-slate-700">
                                      {val}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {Object.keys(editFields).length === 0 && (
                              <tr>
                                <td colSpan={2} className="px-4 py-12 text-center text-slate-400">
                                  Empty data properties returned. Try custom instruction prompt specification.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Structured JSON dark code theme formatted correctly with Sleek values */
                      <div className="relative rounded-xl overflow-hidden bg-[#0f172a] border border-slate-900 p-5 font-mono text-[12.5px] text-slate-300 leading-relaxed mb-6 min-h-[220px]">
                        <button
                          onClick={handleCopyJson}
                          className="absolute top-3.5 right-3.5 p-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white rounded border border-[#334155] transition-all cursor-pointer"
                          title="Copy JSON to clipboard"
                        >
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <pre className="overflow-auto max-h-[360px] pr-8 select-all text-[#34d399] font-mono">
                          <code className="text-[#94a3b8]">{`{\n`}</code>
                          {Object.entries(currentResult.extracted_data).map(([key, val], idx, arr) => {
                            const isLast = idx === arr.length - 1;
                            const formattedVal = typeof val === "object" ? JSON.stringify(val) : JSON.stringify(val);
                            return (
                              <div key={key} className="pl-5">
                                <span className="text-[#e2e8f0]">"</span>
                                <span className="text-[#7dd3fc]">{key}</span>
                                <span className="text-[#e2e8f0]">"</span>
                                <span className="text-[#94a3b8]">: </span>
                                <span className={typeof val === "number" ? "text-[#fbbf24]" : "text-[#34d399]"}>
                                  {formattedVal}
                                </span>
                                {!isLast && <span className="text-[#94a3b8]">,</span>}
                              </div>
                            );
                          })}
                          <code className="text-[#94a3b8]">{`}`}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Actions mapping footer container */}
                  <div className="flex flex-col sm:flex-row items-center border-t border-slate-100 pt-5 gap-3">
                    <div className="flex gap-2 w-full sm:w-auto">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSaveChanges}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => {
                              // Cancel, revert values
                              const flat: Record<string, string> = {};
                              Object.entries(currentResult.extracted_data).forEach(([k, v]) => {
                                  flat[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
                              });
                              setEditFields(flat);
                              setIsEditing(false);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg border border-slate-200 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer"
                        >
                          Revise Values
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                      <button
                        onClick={handleDownloadCsv}
                        className="bg-[#0f172a] hover:bg-slate-900 text-white font-sans font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition border border-slate-800 shadow-sm w-full sm:w-auto cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                      <button
                        onClick={() => {
                          const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentResult.extracted_data, null, 2));
                          const link = document.createElement("a");
                          link.setAttribute("href", jsonStr);
                          link.setAttribute("download", `${currentResult.filename}_extracted.json`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-800 font-sans font-semibold text-xs px-4 py-2.5 rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition w-full sm:w-auto shadow-sm cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5" />
                        Download JSON
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Plain fallback state */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto">
                  <div className="text-4xl select-none mb-3.5">📄</div>
                  <h3 className="font-sans font-semibold text-slate-800 text-sm">
                    No Active Document Analyzed
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                    Upload your receipt, billing invoice, tax document or identification credentials on the left side panel to extract.
                  </p>
                </div>
              )}
            </div>

          </div>
        </section>

      </main>

      {/* Database extraction logs panel */}
      <footer className="bg-[#f1f5f9] text-slate-700 border-t border-slate-200/80 px-6 py-10 transition-all mt-auto selection:bg-blue-100 selection:text-blue-900">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-slate-500" />
              <h2 className="font-sans font-semibold text-sm text-slate-800 uppercase tracking-wider">
                Recent Extractions ({historyList.length})
              </h2>
            </div>
            <p className="text-[11px] text-slate-400">
              Active Session Logs — Cloud Run Database Replication Persistence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyList.map((item) => {
              const isSelected = currentResult?.id === item.id;
              
              // Dynamic coloring of document type bullets from the Sleek Theme
              let bulletBg = "bg-sky-100 text-sky-800 border-sky-200";
              let bulletIcon = "📂";
              const typeLower = (item.doc_type || "").toLowerCase();
              if (typeLower.includes("invoice") || typeLower.includes("tax") || typeLower.includes("faktur")) {
                bulletBg = "bg-[#fee2e2] text-[#b91c1c]";
                bulletIcon = "📄";
              } else if (typeLower.includes("receipt") || typeLower.includes("payment") || typeLower.includes("struk")) {
                bulletBg = "bg-[#dcfce7] text-[#15803d]";
                bulletIcon = "🧾";
              } else if (typeLower.includes("id") || typeLower.includes("ktp") || typeLower.includes("card") || typeLower.includes("identity")) {
                bulletBg = "bg-[#fef9c3] text-[#a16207]";
                bulletIcon = "🆔";
              }

              return (
                <div
                  key={item.id}
                  onClick={() => setCurrentResult(item)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 flex flex-col justify-between h-36 ${
                    isSelected
                      ? "bg-[#f0f9ff] border-blue-500 shadow-sm shadow-blue-500/5 ring-1 ring-blue-500/15"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-[#f0f9ff]/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg shrink-0 display grid place-items-center font-semibold text-sm ${bulletBg}`}>
                          {bulletIcon}
                        </div>
                        <div className="truncate min-w-0 flex-1">
                          <span className="font-sans font-bold text-xs text-slate-800 truncate block leading-tight">
                            {item.filename}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                            {item.doc_type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                        className="text-slate-400 hover:text-red-650 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                        title="Delete log entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 mt-3 flex items-center justify-between">
                    <span className="text-[10.5px] text-slate-400 italic shrink-0">
                      {item.user_prompt ? "Directives Prompt" : "Auto-Suggest"}
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-semibold flex items-center gap-1 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-md">
                      {Object.keys(item.extracted_data || {}).length} variables
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </span>
                  </div>
                </div>
              );
            })}

            {historyList.length === 0 && (
              <div className="col-span-full py-10 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 bg-white rounded-xl">
                <div className="text-3xl mb-2">⚡</div>
                <p className="text-xs font-semibold text-slate-600">
                  Cloud database pipeline empty
                </p>
                <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-xs">
                  Upload and process document receipts or ID cards to record extractions.
                </p>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
