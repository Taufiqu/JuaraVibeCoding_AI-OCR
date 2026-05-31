import os
from dotenv import load_dotenv

# 1. Pastikan load_dotenv() dipanggil di paling atas file 
# Supaya pas lo ngetes di lokal, file .env lo otomatis terbaca
load_dotenv()

class Config:
    # Retrieve secret keys
    SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-secret-keys-juara-vibe-coding")

    APP_URL = os.environ.get("APP_URL")
    
    # DATABASE_URL retrieval and automatic PostgreSQL prefix conversion
    database_url = os.environ.get("DATABASE_URL", "sqlite:///extractor.db")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # === 2. TAMBAHKAN INI: Connection Pooling untuk Stability ===
    # Penting banget di Cloud Run supaya koneksi ke database gak gampang putus/timeout
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,   # Nge-cek koneksi DB masih idup atau kagak sebelum kirim query
        'pool_recycle': 300,     # Otomatis nge-refresh koneksi setiap 5 menit
        'connect_args': {'sslmode': 'require'} if database_url.startswith("postgresql") else {}
    }
    
    # Gemini API Key configuration
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

    # === 3. OPTIMASI: Pindahkan print warning ke luar class ===
    # Biar gak nge-trigger print berulang-ulang pas class Config di-import di modul lain
    
# Validasi ditaruh di luar class agar dieksekusi sekali pas app start
if not Config.GEMINI_API_KEY:
    print("⚠️ Peringatan: GEMINI_API_KEY belum terkonfigurasi di Secrets!")