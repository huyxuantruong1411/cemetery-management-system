import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_NAME = "Arial"
FONT_BOLD = "Arial-Bold"


def _setup_fonts() -> tuple[str, str]:
    """Register system TTF fonts that support Vietnamese Unicode."""
    # Check Windows font paths
    win_font_dir = os.environ.get("WINDIR", "C:\\Windows") + "\\Fonts"
    arial_path = os.path.join(win_font_dir, "arial.ttf")
    arial_bd_path = os.path.join(win_font_dir, "arialbd.ttf")

    if os.path.exists(arial_path):
        try:
            pdfmetrics.registerFont(TTFont(FONT_NAME, arial_path))
            if os.path.exists(arial_bd_path):
                pdfmetrics.registerFont(TTFont(FONT_BOLD, arial_bd_path))
            else:
                pdfmetrics.registerFont(TTFont(FONT_BOLD, arial_path))
            return FONT_NAME, FONT_BOLD
        except Exception:
            pass

    return "Helvetica", "Helvetica-Bold"


class PDFService:
    @classmethod
    def generate_contract_pdf(
        cls,
        contract_code: str,
        contract_type: str,
        customer_name: str,
        customer_phone: str,
        customer_citizen_id: str,
        plot_code: str,
        total_amount: str,
        created_at: datetime,
    ) -> bytes:
        """Generate a complete multi-page PDF contract in Vietnamese with table formatting."""
        regular_font, bold_font = _setup_fonts()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ContractTitle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=16,
            leading=20,
            alignment=1,  # Center
            textColor=colors.HexColor("#24594D"),
        )

        subtitle_style = ParagraphStyle(
            "ContractSubtitle",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=11,
            leading=15,
            alignment=1,
            textColor=colors.HexColor("#475569"),
        )

        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
        )

        body_style = ParagraphStyle(
            "ContractBody",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
        )

        elements = []

        # 1. Header
        elements.append(Paragraph("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", subtitle_style))
        elements.append(Paragraph("Độc lập - Tự do - Hạnh phúc", subtitle_style))
        elements.append(Spacer(1, 14))

        elements.append(Paragraph("HỢP ĐỒNG DỊCH VỤ NGHĨA TRANG TƯ NHÂN", title_style))
        elements.append(
            Paragraph(f"Mã hợp đồng: {contract_code} · Loại: {contract_type}", subtitle_style)
        )
        elements.append(Spacer(1, 20))

        # 2. Bên A: Ban Quản Lý Nghĩa Trang
        elements.append(Paragraph("I. ĐẠI DIỆN BAN QUẢN LÝ NGHĨA TRANG (BÊN A):", section_heading))
        bena_data = [
            [
                Paragraph("<b>Đơn vị quản lý:</b>", body_style),
                Paragraph("Hệ Thống Nghĩa Trang Tư Nhân", body_style),
            ],
            [
                Paragraph("<b>Địa chỉ trụ sở:</b>", body_style),
                Paragraph("Khu Quy Hoạch Nghĩa Trang Sinh Thái", body_style),
            ],
            [
                Paragraph("<b>Điện thoại đường dây nóng:</b>", body_style),
                Paragraph("1900 6868 · Email: hotro@nghiatrang.vn", body_style),
            ],
        ]
        t_a = Table(bena_data, colWidths=[150, 370])
        t_a.setStyle(
            TableStyle(
                [("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
            )
        )
        elements.append(t_a)
        elements.append(Spacer(1, 14))

        # 3. Bên B: Khách Hàng
        elements.append(Paragraph("II. THÔNG TIN KHÁCH HÀNG (BÊN B):", section_heading))
        benb_data = [
            [
                Paragraph("<b>Họ và tên khách hàng:</b>", body_style),
                Paragraph(customer_name, body_style),
            ],
            [
                Paragraph("<b>Số CCCD/Định danh:</b>", body_style),
                Paragraph(customer_citizen_id, body_style),
            ],
            [
                Paragraph("<b>Số điện thoại liên hệ:</b>", body_style),
                Paragraph(customer_phone, body_style),
            ],
        ]
        t_b = Table(benb_data, colWidths=[150, 370])
        t_b.setStyle(
            TableStyle(
                [("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
            )
        )
        elements.append(t_b)
        elements.append(Spacer(1, 14))

        # 4. Chi tiết ô mộ và chi phí
        elements.append(Paragraph("III. ĐỐI TƯỢNG VÀ GIÁ TRỊ GIAO DỊCH:", section_heading))
        deal_data = [
            [
                Paragraph("<b>Mã ô mộ đăng ký:</b>", body_style),
                Paragraph(plot_code, body_style),
            ],
            [
                Paragraph("<b>Tổng giá trị thanh toán:</b>", body_style),
                Paragraph(f"<b>{total_amount} VNĐ</b>", body_style),
            ],
            [
                Paragraph("<b>Ngày lập hợp đồng:</b>", body_style),
                Paragraph(created_at.strftime("%d/%m/%Y"), body_style),
            ],
        ]
        t_deal = Table(deal_data, colWidths=[150, 370])
        t_deal.setStyle(
            TableStyle(
                [("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
            )
        )
        elements.append(t_deal)
        elements.append(Spacer(1, 14))

        # 5. Điều khoản Kim Tĩnh và cam kết
        elements.append(Paragraph("IV. ĐIỀU KHOẢN VÀ CAM KẾT ĐẶC BIỆT:", section_heading))
        terms = [
            "1. Quy tắc Kim Tĩnh bất biến: Sau khi ô mộ hoàn tất thủ tục an táng theo hình thức Kim Tĩnh, cấu trúc ô mộ và slot bị khóa vĩnh viễn, không được phép chuyển nhượng, cải táng hoặc tác động kết cấu.",
            "2. Bên B cam kết cung cấp bản sao hợp lệ giấy báo tử trước khi thực hiện lễ an táng thực địa.",
            "3. Hợp đồng có hiệu lực sau khi hai bên ký văn bản giấy và bản scan được xác nhận lưu trữ trên hệ thống.",
        ]
        for term in terms:
            elements.append(Paragraph(term, body_style))
            elements.append(Spacer(1, 4))

        elements.append(Spacer(1, 24))

        # 6. Chữ ký
        sig_data = [
            [
                Paragraph("<b>ĐẠI DIỆN BÊN A</b><br/>(Ký và ghi rõ họ tên)", subtitle_style),
                Paragraph("<b>ĐẠI DIỆN BÊN B</b><br/>(Ký và ghi rõ họ tên)", subtitle_style),
            ],
            [
                Paragraph("<br/><br/><br/><br/>", body_style),
                Paragraph("<br/><br/><br/><br/>", body_style),
            ],
        ]
        t_sig = Table(sig_data, colWidths=[260, 260])
        elements.append(t_sig)

        doc.build(elements)
        return buffer.getvalue()

    @classmethod
    def generate_receipt_pdf(
        cls,
        invoice_number: str,
        customer_name: str,
        customer_phone: str,
        customer_address: str,
        reason_content: str,
        source_code: str,
        paid_amount_str: str,
        total_amount_in_words: str,
        payment_method_str: str,
        transaction_reference: str | None,
        recorder_name: str,
        issued_date: datetime,
    ) -> bytes:
        """Generate a dignified, professional Vietnamese payment receipt PDF."""
        regular_font, bold_font = _setup_fonts()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ReceiptTitle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=16,
            leading=20,
            alignment=1,  # Center
            textColor=colors.HexColor("#24594D"),
        )

        subtitle_style = ParagraphStyle(
            "ReceiptSubtitle",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=10,
            leading=14,
            alignment=1,
            textColor=colors.HexColor("#475569"),
        )

        label_style = ParagraphStyle(
            "ReceiptLabel",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#1E293B"),
        )

        value_style = ParagraphStyle(
            "ReceiptValue",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
        )

        highlight_style = ParagraphStyle(
            "ReceiptHighlight",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#24594D"),
        )

        elements = []

        # 1. Header
        elements.append(Paragraph("HỆ THỐNG QUẢN LÝ NGHĨA TRANG TƯ NHÂN", subtitle_style))
        elements.append(Paragraph("BAN QUẢN LÝ CÔNG VIÊN NGHĨA TRANG", subtitle_style))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("BIÊN LAI THU TIỀN", title_style))
        elements.append(
            Paragraph(
                f"Mã biên lai: <b>{invoice_number}</b> &nbsp;|&nbsp; Ngày lập: {issued_date.strftime('%d/%m/%Y %H:%M')}",
                subtitle_style,
            )
        )
        elements.append(Spacer(1, 16))

        # 2. Receipt Details Table
        receipt_data = [
            [
                Paragraph("Họ và tên người nộp:", label_style),
                Paragraph(f"<b>{customer_name}</b>", value_style),
            ],
            [
                Paragraph("Số điện thoại:", label_style),
                Paragraph(customer_phone or "Chưa cung cấp", value_style),
            ],
            [
                Paragraph("Địa chỉ:", label_style),
                Paragraph(customer_address or "Chưa cung cấp", value_style),
            ],
            [
                Paragraph("Lý do nộp tiền:", label_style),
                Paragraph(f"{reason_content} (Mã căn cứ: <b>{source_code}</b>)", value_style),
            ],
            [
                Paragraph("Số tiền thanh toán:", label_style),
                Paragraph(f"<b>{paid_amount_str}</b>", highlight_style),
            ],
            [
                Paragraph("Viết bằng chữ:", label_style),
                Paragraph(f"<i>{total_amount_in_words}</i>", value_style),
            ],
            [
                Paragraph("Hình thức thanh toán:", label_style),
                Paragraph(payment_method_str, value_style),
            ],
            [
                Paragraph("Mã tham chiếu / Giao dịch:", label_style),
                Paragraph(transaction_reference or "Thu trực tiếp / Tiền mặt", value_style),
            ],
            [
                Paragraph("Nhân viên thu tiền:", label_style),
                Paragraph(recorder_name, value_style),
            ],
        ]

        t_receipt = Table(receipt_data, colWidths=[160, 350])
        t_receipt.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#E2E8F0")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
                ]
            )
        )
        elements.append(t_receipt)
        elements.append(Spacer(1, 24))

        # 3. Signature block
        elements.append(
            Paragraph(
                f"Ngày {issued_date.day:02d} tháng {issued_date.month:02d} năm {issued_date.year}",
                ParagraphStyle("DateStyle", parent=subtitle_style, alignment=2),
            )
        )
        elements.append(Spacer(1, 10))

        sig_data = [
            [
                Paragraph("<b>NGƯỜI NỘP TIỀN</b><br/>(Ký và ghi rõ họ tên)", subtitle_style),
                Paragraph(
                    "<b>NGƯỜI THU TIỀN / THỦ QUỸ</b><br/>(Ký và ghi rõ họ tên)", subtitle_style
                ),
            ],
            [
                Paragraph("<br/><br/><br/><br/>", value_style),
                Paragraph(f"<br/><br/><br/><b>{recorder_name}</b>", subtitle_style),
            ],
        ]
        t_sig = Table(sig_data, colWidths=[255, 255])
        elements.append(t_sig)

        doc.build(elements)
        return buffer.getvalue()

    @classmethod
    def generate_report_pdf(
        cls,
        report_title: str,
        subtitle: str,
        kpi_cards: list[tuple[str, str]],
        headers: list[str],
        rows: list[list[str]],
        generated_by: str,
    ) -> bytes:
        """Generate a clean, standardized executive summary and tabular report PDF."""
        regular_font, bold_font = _setup_fonts()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=16,
            leading=20,
            alignment=1,
            textColor=colors.HexColor("#24594D"),
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=10,
            leading=13,
            alignment=1,
            textColor=colors.HexColor("#475569"),
        )
        kpi_val_style = ParagraphStyle(
            "ReportKpiVal",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=12,
            leading=15,
            alignment=1,
            textColor=colors.HexColor("#24594D"),
        )
        kpi_lbl_style = ParagraphStyle(
            "ReportKpiLbl",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=9,
            leading=11,
            alignment=1,
            textColor=colors.HexColor("#64748B"),
        )
        tbl_hdr_style = ParagraphStyle(
            "ReportTblHdr",
            parent=styles["Normal"],
            fontName=bold_font,
            fontSize=9,
            leading=11,
            alignment=1,
            textColor=colors.white,
        )
        tbl_cell_style = ParagraphStyle(
            "ReportTblCell",
            parent=styles["Normal"],
            fontName=regular_font,
            fontSize=8,
            leading=10,
            alignment=0,
            textColor=colors.black,
        )

        # Header banner
        elements.append(Paragraph("HỆ THỐNG QUẢN LÝ NGHĨA TRANG TƯ NHÂN", subtitle_style))
        elements.append(Paragraph(f"<b>{report_title.upper()}</b>", title_style))
        elements.append(Paragraph(subtitle, subtitle_style))
        elements.append(Spacer(1, 14))

        # KPI Summary cards
        if kpi_cards:
            kpi_data = [
                [Paragraph(f"<b>{val}</b>", kpi_val_style) for _, val in kpi_cards],
                [Paragraph(lbl, kpi_lbl_style) for lbl, _ in kpi_cards],
            ]
            col_w = 520 / max(len(kpi_cards), 1)
            t_kpi = Table(kpi_data, colWidths=[col_w] * len(kpi_cards))
            t_kpi.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            elements.append(t_kpi)
            elements.append(Spacer(1, 14))

        # Main Data Table
        if headers and rows:
            table_data = [[Paragraph(f"<b>{h}</b>", tbl_hdr_style) for h in headers]]
            for r in rows:
                table_data.append([Paragraph(str(c), tbl_cell_style) for c in r])

            col_w = 520 / len(headers)
            t_data = Table(table_data, colWidths=[col_w] * len(headers))
            t_data.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#24594D")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [colors.white, colors.HexColor("#F8FAFC")],
                        ),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ]
                )
            )
            elements.append(t_data)
            elements.append(Spacer(1, 16))

        # Footer
        now = datetime.now()
        footer_text = f"Báo cáo xuất lúc {now.strftime('%d/%m/%Y %H:%M')} · Người xuất: {generated_by} · Trích xuất từ Cơ sở dữ liệu QL Nghĩa Trang"
        elements.append(Paragraph(footer_text, subtitle_style))

        doc.build(elements)
        return buffer.getvalue()
