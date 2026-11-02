# LeadSort Pro — Full-Stack Customer Lead Priority & Feedback Normalizer

An enterprise-grade, full-stack web application designed to intake messy, multilingual spreadsheet customer records, extract clean customer contact entities, translate international feedback to English, classify purchasing intent using the **Groq LLM REST API**, and automatically reorganize leads by priority:
**High Interest** ➔ **Interested** ➔ **Not Interested**.

---

## 🌟 Key Architecture & Highlights

- **Backend**: Python with **Flask REST API**, **Requests**, **Pandas**, and **OpenPyXL**.
- **Frontend**: Responsive modern UI built with **HTML5**, **Tailwind CSS**, and **Font Awesome 6**, styled in an executive dark glassmorphic palette.
- **AI Engine**: Powered by **Groq Cloud API** (`https://api.groq.com/openai/v1/chat/completions`) using the Groq API key securely housed in the Python backend.
- **Security Upgrade**: In the original standalone `lead.html`, the secret Groq API key was exposed in client-side browser JavaScript. This full-stack architecture **completely protects the API key** by isolating it inside the backend (`.env` and `config.py`).
- **Resilience & Rate Limiting**: Includes automated 429 rate limit backoff parsing (`try again in Xs`), model fallback cycling, and an offline local heuristic classification engine so customer data is never dropped.
- **Direct Styled Excel Export**: Backend generates formatted `.xlsx` workbooks with custom header colors (Emerald-700), distinct priority row highlights, centered scores, and auto-spaced columns.

---

## 📁 Project Directory Structure

```text
leadsort_pro_fullstack/
├── .env                  # Groq API key and environment configuration
├── .env.example          # Template for environment settings
├── .gitignore            # Git exclusion rules
├── README.md             # Complete documentation and setup guide
├── requirements.txt      # Python dependencies
├── config.py             # Application settings and model configurations
├── app.py                # Main Flask REST API application
├── run.py                # Convenient CLI launcher
├── services/
│   ├── __init__.py
│   ├── groq_service.py   # Groq LLM integration, rate limiting, and intent scoring
│   └── excel_service.py  # Spreadsheets parsing (.xlsx, .xls, .csv) and styled generation
├── templates/
│   └── index.html        # Front-end dashboard template
├── static/
│   ├── css/
│   │   └── style.css     # Custom dark glassmorphic styling
│   └── js/
│       └── app.js        # Dynamic front-end client calling Flask REST endpoints
└── sample_data/
    ├── sample_leads.csv  # Ready-to-test multilingual sample dataset (CSV)
    └── sample_leads.xlsx # Ready-to-test multilingual sample dataset (Excel)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.8 or higher installed on your machine.
- Pip (Python package manager).

### 2. Setup Virtual Environment (Recommended)

#### On macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

#### On Windows:
```cmd
python -m venv venv
venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
The `.env` file is already created and pre-configured with the Groq API key from your original `lead.html`:
```dotenv
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
BATCH_SIZE=2
PORT=5000
DEBUG=True
```

### 5. Launch Application
You can run either:
```bash
python run.py
```
or
```bash
python app.py
```

### 6. Access the Web Dashboard
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the interactive web UI dashboard. |
| `GET` | `/api/health` | Healthcheck & API status (configured model, key status). |
| `GET` | `/api/sample-data` | Retrieves 9 multilingual sample customer records. |
| `POST` | `/api/upload` | Uploads and parses `.xlsx`, `.xls`, or `.csv` files into structured JSON. |
| `POST` | `/api/classify` | Batched classification and translation via Groq LLM. |
| `POST` | `/api/sort` | Reorganizes records: High Interest ➔ Interested ➔ Not Interested. |
| `POST` | `/api/export` | Generates and downloads a styled `.xlsx` workbook. |

---

## 💡 How It Works

1. **Importing Data**:
   - Drag & drop any `.xlsx`, `.xls`, or `.csv` file into the upload zone, or click **"Load Sample Dataset"** to load sample entries across German, Spanish, French, Hindi, Japanese, Swedish, Arabic, and English.
2. **Analysis Pipeline**:
   - Clicking **"Classify & Sort Leads"** streams small batches to the Flask `/api/classify` endpoint.
   - The Groq LLM extracts the customer name, organization, and contact details from unstructured rows, translates foreign feedback into clean English, evaluates purchasing intent, and outputs a score (0–100).
3. **Automated Sorting**:
   - The `/api/sort` endpoint orders leads strictly into:
     - **1st:** `High Interest` (Urgent procurement, buying signals, pilot requests)
     - **2nd:** `Interested` (Informational requests, specification inquiries, demos)
     - **3rd:** `Not Interested` (Unsubscribe requests, budget freezes, rejections)
4. **Interactive Inspection**:
   - Click on any table row to open the detailed modal card showing the original language feedback, English translation, evaluation reasoning, and raw source JSON.
5. **Excel Export**:
   - Click **"Export Sorted XLS"** to download the finalized, styled Excel spreadsheet.

---

## 👨‍💻 Attribution
- **Engineered by:** Suraj Santra
- **Organization:** CodeLiner
- **Original Source:** Converted from standalone `lead.html` into Full-Stack Flask Architecture.
