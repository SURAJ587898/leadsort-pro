#!/usr/bin/env python3
"""
LeadSort Pro - Full Stack Application Runner
Validates requirements and starts the Flask server.
"""
import sys

def main():
    try:
        from app import app
        from config import Config
        print("=" * 65)
        print("   LeadSort Pro - Full Stack Flask REST API & Web App")
        print("   Multilingual Feedback Normalizer & Groq Priority Sorter")
        print("=" * 65)
        print(f" * Server running on: http://127.0.0.1:{Config.PORT}")
        print(f" * Groq Model:        {Config.GROQ_MODEL}")
        print(f" * API Key Status:    {'Configured' if Config.GROQ_API_KEY else 'Missing'}")
        print(f" * Batch Size:        {Config.BATCH_SIZE}")
        print("=" * 65)
        app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
    except ImportError as e:
        print(f"\nError importing dependencies: {e}")
        print("Please install requirements first:")
        print("  pip install -r requirements.txt\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
