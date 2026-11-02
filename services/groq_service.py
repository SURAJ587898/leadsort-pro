import json
import re
import time
import requests
from config import Config

class GroqService:
    """
    Handles LLM classification and feedback analysis via Groq API.
    Extracts structured entities, normalizes multilingual reviews, translates to English,
    assigns priority intent categories and scores, and provides local heuristic fallback.
    """

    SYSTEM_PROMPT = """You are a Customer Lead & Feedback Classification Engine.
Task:
1. Extract Customer Name, Company, and Contact Info from messy unstructured data.
2. Detect the language of the feedback and provide an accurate English translation.
3. Classify interest level strictly into: "High Interest", "Interested", or "Not Interested".
4. Assign intent_score (0-100) and concise reason.

Output JSON format:
{"records":[{"original_index":0,"customer_name":"...","company_name":"...","contact_info":"...","detected_language":"...","original_feedback":"...","english_translation":"...","interest_category":"High Interest"|"Interested"|"Not Interested","intent_score":0,"primary_reason":"..."}]}"""

    def __init__(self, api_key=None, model=None):
        self.api_key = api_key or Config.GROQ_API_KEY
        self.model = model or Config.GROQ_MODEL
        self.fallback_models = Config.FALLBACK_MODELS
        self.api_url = Config.GROQ_API_URL
        self.max_retries = Config.MAX_RETRIES
        self.timeout = Config.REQUEST_TIMEOUT

    def classify_batch(self, batch_rows, start_index=0):
        """
        Classifies a batch of raw spreadsheet rows using Groq LLM API.
        Falls back to local heuristic classification if API fails or is unreachable.
        """
        if not batch_rows:
            return []

        user_payload = {
            "items": [
                {
                    "original_index": start_index + idx,
                    "data": row
                }
                for idx, row in enumerate(batch_rows)
            ]
        }

        active_model = self.model
        attempt = 0
        ai_records = None

        while attempt < self.max_retries:
            attempt += 1
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                body = {
                    "model": active_model,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 1500
                }

                response = requests.post(
                    self.api_url,
                    headers=headers,
                    json=body,
                    timeout=self.timeout
                )

                if response.status_code == 429:
                    err_json = response.json() if response.content else {}
                    err_msg = err_json.get("error", {}).get("message", "")
                    wait_match = re.search(r"try again in ([0-9.]+)s", err_msg, re.IGNORECASE)
                    wait_seconds = float(wait_match.group(1)) + 1.0 if wait_match else (attempt * 3.0)
                    wait_seconds = max(2.0, min(wait_seconds, 15.0))
                    time.sleep(wait_seconds)

                    if attempt >= 2 and self.fallback_models:
                        fallback_idx = (attempt - 2) % len(self.fallback_models)
                        active_model = self.fallback_models[fallback_idx]
                    continue

                if response.status_code != 200:
                    if attempt < self.max_retries and self.fallback_models:
                        active_model = self.fallback_models[(attempt - 1) % len(self.fallback_models)]
                        time.sleep(1.5)
                        continue
                    break

                res_json = response.json()
                content_str = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content_str:
                    parsed = json.loads(content_str)
                    ai_records = parsed.get("records") or parsed.get("data") or []
                    break

            except Exception:
                if attempt < self.max_retries:
                    time.sleep(1.0)
                    if self.fallback_models:
                        active_model = self.fallback_models[(attempt - 1) % len(self.fallback_models)]
                else:
                    break

        classified = []
        for idx, raw in enumerate(batch_rows):
            target_index = start_index + idx
            matching_ai = None
            if ai_records:
                for r in ai_records:
                    if r.get("original_index") == target_index:
                        matching_ai = r
                        break
                if not matching_ai and idx < len(ai_records):
                    matching_ai = ai_records[idx]

            if matching_ai:
                raw_cat = str(matching_ai.get("interest_category", "Interested"))
                if re.search(r"high", raw_cat, re.IGNORECASE):
                    category = "High Interest"
                elif re.search(r"not|uninterested|low|disqualified", raw_cat, re.IGNORECASE):
                    category = "Not Interested"
                else:
                    category = "Interested"

                score = matching_ai.get("intent_score")
                if not isinstance(score, (int, float)):
                    score = 90 if category == "High Interest" else (60 if category == "Interested" else 15)

                classified.append({
                    "id": target_index + 1,
                    "customer_name": matching_ai.get("customer_name") or self.extract_fallback_field(raw, ['name', 'cust', 'client', 'contact', 'user']) or f"Customer #{target_index + 1}",
                    "company_name": matching_ai.get("company_name") or self.extract_fallback_field(raw, ['company', 'org', 'business', 'corp']) or "N/A",
                    "contact_info": matching_ai.get("contact_info") or self.extract_fallback_field(raw, ['email', 'phone', 'mobile', 'cell', 'mail']) or "N/A",
                    "detected_language": matching_ai.get("detected_language") or "Auto-detected",
                    "original_feedback": matching_ai.get("original_feedback") or self.extract_fallback_feedback(raw),
                    "english_translation": matching_ai.get("english_translation") or matching_ai.get("original_feedback") or self.extract_fallback_feedback(raw),
                    "interest_category": category,
                    "intent_score": int(score),
                    "primary_reason": matching_ai.get("primary_reason") or "Evaluated by intent classification.",
                    "raw_data": raw
                })
            else:
                classified.append(self.fallback_local_classification(raw, target_index))

        return classified

    def fallback_local_classification(self, raw, index):
        """Rule-based heuristic fallback ensuring user data is never lost."""
        feedback = self.extract_fallback_feedback(raw)
        lower = feedback.lower()
        category = "Interested"
        score = 55
        reason = "Contextual heuristic classification."
        detected_lang = "English"

        if any(w in lower for w in ["wir", "sind", "begeistert", "angebot", "bitte", "nicht", "kein"]):
            detected_lang = "German"
        elif any(w in lower for w in ["no nos", "interesa", "precio", "pésimas", "gracias"]):
            detected_lang = "Spanish"
        elif any(w in lower for w in ["le logiciel", "démonstration", "prochain", "merci"]):
            detected_lang = "French"
        elif any(w in lower for w in ["नमस्ते", "पसंद", "प्रपोजल", "प्रोजेक्ट"]):
            detected_lang = "Hindi"
        elif any(w in lower for w in ["現在", "検討中", "関心", "資料"]):
            detected_lang = "Japanese"
        elif any(w in lower for w in ["inte", "avtal", "kontakta"]):
            detected_lang = "Swedish"
        elif any(w in lower for w in ["نحن", "بحاجة", "أسرع", "عقد"]):
            detected_lang = "Arabic"

        high_indicators = [
            "buy", "urgent", "enterprise", "quote", "immediately", "pilot",
            "contract", "licenses", "proposal", "procurement", "begeistert",
            "sofort", "पसंद", "démonstration", "بحاجة"
        ]
        low_indicators = [
            "no", "stop", "unsubscribe", "not interested", "kein interesse",
            "expensive", "caro", "disqualified", "frozen", "spam", "pésimas", "inte just nu"
        ]

        if any(ind in lower for ind in high_indicators):
            category = "High Interest"
            score = 92
            reason = "Urgent procurement indicator or strong purchasing intent."
        elif any(ind in lower for ind in low_indicators):
            category = "Not Interested"
            score = 10
            reason = "Explicit rejection, disinterest, or disqualification."

        return {
            "id": index + 1,
            "customer_name": self.extract_fallback_field(raw, ['name', 'cust', 'contact']) or f"Lead #{index + 1}",
            "company_name": self.extract_fallback_field(raw, ['company', 'corp', 'org']) or "Unspecified",
            "contact_info": self.extract_fallback_field(raw, ['email', 'phone', 'mail', 'cel']) or "Unspecified",
            "detected_language": detected_lang,
            "original_feedback": feedback,
            "english_translation": feedback,
            "interest_category": category,
            "intent_score": score,
            "primary_reason": reason,
            "raw_data": raw
        }

    @staticmethod
    def extract_fallback_field(row, keywords):
        for key, val in row.items():
            lower_key = str(key).lower()
            if any(k in lower_key for k in keywords):
                if val and str(val).strip():
                    return str(val).strip()
        return None

    @staticmethod
    def extract_fallback_feedback(row):
        feedback_keys = ['feedback', 'remark', 'notes', 'comment', 'review', 'message', 'text', 'feetback', 'fitback']
        for key, val in row.items():
            lower_key = str(key).lower()
            if any(k in lower_key for k in feedback_keys):
                if val:
                    return str(val).strip()
        longest = ""
        for val in row.values():
            s = str(val or "").strip()
            if len(s) > len(longest):
                longest = s
        return longest or "No feedback text available"

    @staticmethod
    def sort_records_by_priority(records):
        priority_map = {
            "High Interest": 1,
            "Interested": 2,
            "Not Interested": 3
        }

        def sort_key(item):
            order = priority_map.get(item.get("interest_category"), 4)
            score = item.get("intent_score", 0)
            return (order, -score)

        sorted_list = sorted(records, key=sort_key)
        for idx, item in enumerate(sorted_list):
            item["rank"] = idx + 1
        return sorted_list
