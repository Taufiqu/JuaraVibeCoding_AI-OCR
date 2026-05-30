import os

class Config:
    # Retrieve secrete keys
    SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-secret-keys-juara-vibe-coding")
    
    # DATABASE_URL retrieval and automatic PostgreSQL prefix conversion
    database_url = os.environ.get("DATABASE_URL", "sqlite:///extractor.db")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Gemini API Key configuration
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
