import io
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class ExcelService:
    """Service to handle spreadsheet parsing (.xlsx, .xls, .csv) and styled Excel generation."""

    @staticmethod
    def parse_uploaded_file(file_stream, filename):
        lower_name = filename.lower()
        if lower_name.endswith('.csv'):
            try:
                df = pd.read_csv(file_stream, encoding='utf-8')
            except UnicodeDecodeError:
                file_stream.seek(0)
                df = pd.read_csv(file_stream, encoding='latin1')
        elif lower_name.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_stream)
        else:
            raise ValueError(f"Unsupported file format for '{filename}'. Please upload .xlsx, .xls, or .csv.")

        df = df.fillna("")
        records = df.to_dict(orient="records")
        clean_records = []
        for row in records:
            clean_row = {str(k).strip(): (str(v).strip() if not isinstance(v, (int, float)) else v) for k, v in row.items()}
            clean_records.append(clean_row)

        return clean_records

    @staticmethod
    def generate_sorted_excel(records):
        wb = Workbook()
        ws = wb.active
        ws.title = "Sorted Leads by Intent"

        headers = [
            "Sort Rank",
            "Interest Priority",
            "Intent Score (0-100)",
            "Customer / Contact Name",
            "Company / Organization",
            "Contact Details",
            "Original Language",
            "Original Customer Feedback",
            "English Translation",
            "Classification Reason"
        ]

        ws.append(headers)

        for idx, item in enumerate(records):
            ws.append([
                item.get("rank", idx + 1),
                item.get("interest_category", "Interested"),
                item.get("intent_score", 0),
                item.get("customer_name", ""),
                item.get("company_name", ""),
                item.get("contact_info", ""),
                item.get("detected_language", ""),
                item.get("original_feedback", ""),
                item.get("english_translation", ""),
                item.get("primary_reason", "")
            ])

        header_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        regular_font = Font(name="Calibri", size=10)
        bold_font = Font(name="Calibri", size=10, bold=True)
        
        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        high_fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
        med_fill = PatternFill(start_color="F0F9FF", end_color="F0F9FF", fill_type="solid")
        low_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border
        ws.row_dimensions[1].height = 28

        for row_num in range(2, len(records) + 2):
            category_val = ws.cell(row=row_num, column=2).value
            row_fill = high_fill if category_val == "High Interest" else (med_fill if category_val == "Interested" else low_fill)

            for col_num in range(1, len(headers) + 1):
                cell = ws.cell(row=row_num, column=col_num)
                cell.font = regular_font
                cell.border = thin_border
                cell.fill = row_fill

                if col_num in [1, 3]:
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    if col_num == 3 and category_val == "High Interest":
                        cell.font = bold_font
                elif col_num == 2:
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    cell.font = bold_font
                elif col_num in [8, 9, 10]:
                    cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

            ws.row_dimensions[row_num].height = 36

        col_widths = {
            1: 12, 2: 20, 3: 16, 4: 26, 5: 26,
            6: 30, 7: 18, 8: 45, 9: 45, 10: 40
        }

        for col_idx, width in col_widths.items():
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        ws.freeze_panes = "A2"

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output
