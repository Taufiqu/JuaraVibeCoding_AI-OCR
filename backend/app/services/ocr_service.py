import os
import json
import google.generativeai as genai
from flask import current_app

def process_document_with_gemini(file_bytes, mime_type, user_prompt=None):
    """
    Integrates Gemini 1.5 Flash to automatically extract data from document files (PDF/Images).
    Toggles cleanly between Auto-Suggest Mode (default keys) and Custom Prompt Mode (user requested).
    Always returns structured JSON output.
    """
    # Grab API key from config or fallback to system environment variables
    api_key = current_app.config.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY model credentials not set in environment.")

    # Establish configuration
    genai.configure(api_key=api_key)

    # We use 'gemini-1.5-flash' as requested explicitly by the user for performance and cost
    model_name = "gemini-1.5-flash"

    # Set system instructions forcing structured output
    system_instruction = (
        "You are an expert AI-powered Document Extraction System.\n"
        "Your task is to analyze document graphics/text (such as Tax Invoices, Money Orders, Bank Receipts, "
        "National ID cards, Contracts, and Bills) and translate them into actionable structured items.\n\n"
        "You must return a raw JSON structure containing EXACTLY the following format:\n"
        "{\n"
        "  \"document_type\": \"An auto-detected classifications name of the document context (e.g. 'Faktur Pajak', 'Bukti Setor', 'KTP', 'Receipt')\",\n"
        "  \"extracted_data\": {\n"
        "    ... (descriptive key-value fields containing your findings) ...\n"
        "  },\n"
        "  \"confidence\": \"High/Medium/Low rating based on the clarity and structural resolution\"\n"
        "}\n\n"
        "No surrounding markdown markdown-blocks, explanation strings or headers are permitted. Return ONLY valid JSON."
    )

    # Dynamic target prompt formulation based on Mode input
    if user_prompt and user_prompt.strip():
        # Custom Prompt Mode
        target_prompt = (
            f"Extract specific details from this document following these user instructions:\n"
            f"\"{user_prompt}\"\n\n"
            f"Represent fields retrieved as descriptive keys nested under the 'extracted_data' dictionary."
        )
    else:
        # Auto-Suggest Mode
        target_prompt = (
            "Analyze the document and automatically extract all critical key-value pairings. "
            "Highlight entities, reference/invoice numbers, dates, buyers, sellers, item descriptions, quantities, "
            "subtotals, taxes, and final totals. Place all matches inside the 'extracted_data' block."
        )

    # Set up inline binary content
    contents = [
        {
            "mime_type": mime_type,
            "data": file_bytes
        },
        target_prompt
    ]

    # Instantiate the model
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_instruction
    )

    # Enforce response MIME Type rules
    generation_config = genai.types.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.1
    )

    # Call Gemini model
    response = model.generate_content(
        contents=contents,
        generation_config=generation_config
    )

    if not response or not response.text:
        raise Exception("API request finished but returned an empty response.")

    # Clean and parse JSON structure safely
    raw_text = response.text.strip()
    try:
        data = json.loads(raw_text)
        
        # Enforce consistency in result keys
        if "document_type" not in data:
            data["document_type"] = "Unknown Document"
        if "extracted_data" not in data:
            data["extracted_data"] = {}
        if "confidence" not in data:
            data["confidence"] = "Medium"
            
        return data
    except json.JSONDecodeError:
        # Emergency backup sanitize routine for trailing code block tags
        try:
            cleaned = raw_text
            if cleaned.startswith("```json"):
                cleaned = cleaned.replace("```json", "", 1)
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            return data
        except Exception:
            raise Exception(f"Failed to isolate structured JSON formatting. Raw text was: {raw_text}")
