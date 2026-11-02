import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration settings."""
    # Groq API key extracted securely from lead.html
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", " API KEY PUT")
    
    # Preferred Groq production models with fallbacks
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    FALLBACK_MODELS = [
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "llama3-70b-8192",
        "mixtral-8x7b-32768"
    ]
    
    GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
    
    # Pipeline batching & retry settings
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "2"))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "4"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "45"))
    
    # Server settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5000"))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB max upload
