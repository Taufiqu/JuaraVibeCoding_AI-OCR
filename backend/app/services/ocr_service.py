import os
import json
import google.generativeai as genai
from flask import current_app
from pydantic import BaseModel, Field

# 1. Kunci skema output universal secara ketat menggunakan Pydantic
class UniversalExtractionSchema(BaseModel):
    document_type: str = Field(description="Klasifikasi jenis dokumen (misal: 'Faktur Pajak', 'Bukti Setor', 'Resume', 'Receipt')")
    extracted_data: dict = Field(description="Semua pasangan data kunci (key-value) penting yang berhasil ditemukan di dalam dokumen. TIDAK BOLEH KOSONG.")
    confidence: str = Field(description="Tingkat keyakinan hasil ekstraksi: High, Medium, atau Low")

def process_document_with_gemini(file_bytes, mime_type, user_prompt=None):
    """
    Integrates Gemini 1.5 Flash to automatically extract data from document files (PDF/Images).
    Toggles cleanly between Auto-Suggest Mode (default keys) and Custom Prompt Mode (user requested).
    Always returns structured JSON output strictly bounded by Pydantic Schema.
    """
    api_key = current_app.config.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY model credentials not set in environment.")

    genai.configure(api_key=api_key)
    model_name = "gemini-1.5-flash"

    # 2. System instruction dibikin lebih tegas dan fokus pada logika bisnis
    system_instruction = (
        "Kamu adalah sistem AI Ekstraktor Dokumen Universal yang sangat cerdas.\n"
        "Tugas utamanya adalah menganalisis gambar/teks dokumen secara mendalam, mengidentifikasi tipe dokumen, "
        "dan mengekstrak semua informasi penting ke dalam objek 'extracted_data'.\n"
        "Kamu WAJIB mengisi objek 'extracted_data' dengan informasi teks yang terlihat, jangan biarkan objek tersebut kosong."
    )

    if user_prompt and user_prompt.strip():
        # Custom Prompt Mode
        target_prompt = (
            f"Ekstrak detail spesifik dari dokumen ini sesuai instruksi kustom user berikut:\n"
            f"\"{user_prompt}\"\n\n"
            f"Simpan field-field hasil request user tersebut sebagai key-value di dalam dictionary 'extracted_data'."
        )
    else:
        # Auto-Suggest Mode
        target_prompt = (
            "Analisis dokumen ini secara komprehensif dan lakukan auto-extract untuk semua key-value penting. "
            "Jika ini dokumen pajak/invoice, ambil NPWP, DPP, PPN, nomor faktur, nama perusahaan, dan total nominal.\n"
            "Jika ini CV/Resume, ambil Nama Lengkap, Kontak, Riwayat Pendidikan, Pengalaman, dan Skill.\n"
            "Masukkan semua temuan key-value tersebut ke dalam block 'extracted_data'."
        )

    contents = [
        {
            "mime_type": mime_type,
            "data": file_bytes
        },
        target_prompt
    ]

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_instruction
    )

    # 3. UPDATE DI SINI: Masukkan response_schema Pydantic ke config inferensi
    generation_config = {
        "response_mime_type": "application/json",
        "response_schema": UniversalExtractionSchema, # <--- MEMAKSA GEMINI IKUT ATURAN KITA
        "temperature": 0.1
    }

    response = model.generate_content(
        contents=contents,
        generation_config=generation_config
    )

    if not response or not response.text:
        raise Exception("API request finished but returned an empty response.")

    raw_text = response.text.strip()
    try:
        data = json.loads(raw_text)
        return data
    except json.JSONDecodeError:
        # Fallback sanitize cadangan
        try:
            cleaned = raw_text
            if cleaned.startswith("```json"):
                cleaned = cleaned.replace("```json", "", 1)
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except Exception:
            raise Exception(f"Failed to isolate structured JSON formatting. Raw text was: {raw_text}")