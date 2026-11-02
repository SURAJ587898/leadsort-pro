import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from config import Config
from services.groq_service import GroqService
from services.excel_service import ExcelService

app = Flask(__name__)
app.config.from_object(Config)

groq_service = GroqService()
excel_service = ExcelService()

SAMPLE_DATASET = [
  {
    "Raw Company Info": "TechCorp Solutions (ID: 901)",
    "Cust Contact": "Hans Mueller (Germany) - hans.mueller@techcorp.de",
    "Remark / Feedback Notes": "Wir sind extrem begeistert von Ihrer Software und möchten nächsten Monat 200 Enterprise-Lizenzen abschließen. Bitte senden Sie uns das Angebot umgehend zu!",
    "Misc Col": "Priority: Urgent"
  },
  {
    "Raw Company Info": "Retail Innovate LatAm",
    "Cust Contact": "Maria Rodriguez | Cel: +34 612 889 001 | maria@retailinnovate.es",
    "Remark / Feedback Notes": "No nos interesa en absoluto. Su precio es exorbitante y el servicio posventa tiene pésimas críticas.",
    "Misc Col": "Ref: cold-outreach"
  },
  {
    "Raw Company Info": "Le Petit Atelier (Paris)",
    "Cust Contact": "Jean Dupont (dupont.j@atelier.fr)",
    "Remark / Feedback Notes": "Le logiciel semble convenable. Pourriez-vous nous organiser une démonstration technique mardi prochain avec notre équipe ?",
    "Misc Col": "Follow-up requested"
  },
  {
    "Raw Company Info": "Apex Logistics India Pvt Ltd",
    "Cust Contact": "Rajesh Sharma (rajesh@apexlogistics.in, +91 98200 12345)",
    "Remark / Feedback Notes": "नमस्ते, हमें आपका टूल बहुत पसंद आया। हम तुरंत पायलट प्रोजेक्ट शुरू करने के लिए तैयार हैं। कृपया कमर्शियल प्रपोजल और डिस्काउंट बताएं।",
    "Misc Col": "Urgent procurement"
  },
  {
    "Raw Company Info": "Tokyo FinTech Hub",
    "Cust Contact": "Kenji Sato (sato@tokyofintech.co.jp)",
    "Remark / Feedback Notes": "現在、社内のシステム刷新を検討中です。御社のAIソリューションに関心があります。仕様書とセキュリティ認証の資料を送っていただけますか。",
    "Misc Col": "Inquiry inbound"
  },
  {
    "Raw Company Info": "Nordic Clean Energy",
    "Cust Contact": "Astrid Lindgren (astrid@nordicenergy.se)",
    "Remark / Feedback Notes": "Inte just nu. Vi har precis tecknat ett tvåårigt avtal med en annan leverantör. Kontakta oss inte igen.",
    "Misc Col": "Disqualified"
  },
  {
    "Raw Company Info": "Atlas Global Trading (Dubai)",
    "Cust Contact": "Tariq Al-Mansoor (tariq@atlasglobal.ae)",
    "Remark / Feedback Notes": "نحن بحاجة ماسة إلى هذا الحل لأتمتة عمليات الشحن لدينا في أسرع وقت. نود عقد اجتماع افتراضي غداً لمناقشة العقود.",
    "Misc Col": "Enterprise Lead"
  },
  {
    "Raw Company Info": "NextGen Software US",
    "Cust Contact": "Sarah Jenkins (sarah.j@nextgen.io)",
    "Remark / Feedback Notes": "Maybe revisit in Q4 next year. Budget is completely frozen right now due to restructuring.",
    "Misc Col": "Nurture lead"
  },
  {
    "Raw Company Info": "Unknown Lead - Row #42",
    "Cust Contact": "Anonymous Visitor <web-lead-99@yahoo.com>",
    "Remark / Feedback Notes": "Stop emailing me. Unsubscribe immediately.",
    "Misc Col": "Spam complaint"
  }
]

@app.route("/")
def index():
    """Serves the front-end dashboard."""
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health_check():
    """System health check and configuration status."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "groq_configured": bool(Config.GROQ_API_KEY),
        "model": Config.GROQ_MODEL,
        "batch_size": Config.BATCH_SIZE
    })

@app.route("/api/sample-data", methods=["GET"])
def get_sample_data():
    """Returns the sample multilingual dataset."""
    return jsonify({
        "success": True,
        "filename": "sample_multilingual_leads.xlsx",
        "total_rows": len(SAMPLE_DATASET),
        "data": SAMPLE_DATASET
    })

@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Parses an uploaded spreadsheet (.xlsx, .xls, .csv)."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided in request."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"success": False, "error": "Empty filename."}), 400

    try:
        records = excel_service.parse_uploaded_file(file.stream, file.filename)
        return jsonify({
            "success": True,
            "filename": file.filename,
            "total_rows": len(records),
            "columns": list(records[0].keys()) if records else [],
            "data": records
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/api/classify", methods=["POST"])
def classify():
    """
    Classifies a batch of rows or full dataset using the Groq API.
    Request body: { "rows": [...], "startIndex": 0 }
    """
    body = request.get_json() or {}
    rows = body.get("rows", [])
    start_index = int(body.get("startIndex", 0))

    if not rows:
        return jsonify({"success": False, "error": "No rows provided for classification."}), 400

    try:
        classified = groq_service.classify_batch(rows, start_index=start_index)
        return jsonify({
            "success": True,
            "count": len(classified),
            "records": classified
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/sort", methods=["POST"])
def sort_leads():
    """
    Sorts classified records strictly into:
    High Interest -> Interested -> Not Interested
    and descending intent scores, assigning rank #1, #2, etc.
    """
    body = request.get_json() or {}
    records = body.get("records", [])

    if not records:
        return jsonify({"success": False, "error": "No records to sort."}), 400

    sorted_records = groq_service.sort_records_by_priority(records)
    
    high = sum(1 for r in sorted_records if r.get("interest_category") == "High Interest")
    med = sum(1 for r in sorted_records if r.get("interest_category") == "Interested")
    low = sum(1 for r in sorted_records if r.get("interest_category") == "Not Interested")

    return jsonify({
        "success": True,
        "sorted_records": sorted_records,
        "metrics": {
            "total": len(sorted_records),
            "high_interest": high,
            "interested": med,
            "not_interested": low
        }
    })

@app.route("/api/export", methods=["POST"])
def export_excel():
    """Generates and streams a styled Excel file containing sorted leads."""
    body = request.get_json() or {}
    records = body.get("records", [])

    if not records:
        return jsonify({"success": False, "error": "No records provided to export."}), 400

    try:
        excel_buffer = excel_service.generate_sorted_excel(records)
        date_str = datetime.now().strftime("%Y-%m-%d")
        download_name = f"Sorted_Customer_Leads_{date_str}.xlsx"

        return send_file(
            excel_buffer,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=download_name
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
