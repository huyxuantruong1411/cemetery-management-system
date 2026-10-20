import io
import sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import app.main  # noqa: F401
from app.db.session import SessionLocal
from app.modules.documents.models import FileObject
from app.modules.plots.models import BurialHistory, Plot
from app.modules.profiles.models import DeceasedProfile


def generate_ceremony_image(
    title: str,
    subtitle: str,
    location_code: str,
    action_label: str = "Nghi Thức An Táng",
    accent_color: tuple[int, int, int] = (16, 185, 129),
) -> bytes:
    width, height = 800, 600
    bg_start = (15, 23, 42)
    bg_end = (30, 41, 59)
    img = Image.new("RGB", (width, height), color=bg_start)
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / height
        r = int(bg_start[0] * (1 - ratio) + bg_end[0] * ratio)
        g = int(bg_start[1] * (1 - ratio) + bg_end[1] * ratio)
        b = int(bg_start[2] * (1 - ratio) + bg_end[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Outer border
    draw.rectangle([16, 16, width - 16, height - 16], outline=accent_color, width=2)
    draw.rectangle([24, 24, width - 24, height - 24], outline=(71, 85, 105), width=1)

    # Header bar
    draw.rectangle([25, 25, width - 25, 80], fill=(30, 41, 59))
    draw.text(
        (40, 42),
        "CÔNG VIÊN NGHĨA TRANG VĨNH HẰNG - HỒ SƠ THỰC ĐỊA",
        fill=(226, 232, 240),
    )

    # Watermark Stamp
    draw.rectangle([width - 240, 36, width - 40, 70], outline=accent_color, width=1)
    draw.text((width - 225, 45), f"VỊ TRÍ: {location_code}", fill=accent_color)

    # Center illustration box
    box_top, box_bottom = 110, 470
    draw.rectangle([40, box_top, width - 40, box_bottom], fill=(15, 23, 42), outline=(51, 65, 85), width=2)

    # Category badge
    draw.rectangle([56, box_top + 16, 260, box_top + 48], fill=accent_color)
    draw.text((70, box_top + 23), action_label.upper(), fill=(255, 255, 255))

    # Title & Subtitle
    draw.text((56, box_top + 70), title, fill=(248, 250, 252))
    draw.text((56, box_top + 110), subtitle, fill=(148, 163, 184))

    for i in range(1, 4):
        y_pos = box_top + 150 + i * 40
        draw.line([(60, y_pos), (width - 60, y_pos)], fill=(30, 41, 59), width=1)

    draw.text((60, box_top + 160), f"* Mã nhận diện thực địa: {location_code}", fill=(100, 116, 139))
    draw.text((60, box_top + 200), "* Tiêu chuẩn nghiệm thu: Đạt chuẩn quy trình an táng thực địa & quản trang", fill=(100, 116, 139))
    draw.text((60, box_top + 240), "* Trạng thái dữ liệu: Đã xác thực điện tử và lưu trữ MinIO Object Storage", fill=(100, 116, 139))

    # Footer metadata bar
    draw.rectangle([25, height - 70, width - 25, height - 25], fill=(30, 41, 59))
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")
    draw.text((40, height - 54), f"Thời gian ghi nhận: {now_str}", fill=(148, 163, 184))
    draw.text((width - 260, height - 54), "XÁC NHẬN BỞI BAN QUẢN TRANG", fill=accent_color)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def fix_all_burial_evidence_photos():
    db = SessionLocal()
    try:
        bhs = db.query(BurialHistory).all()
        print(f"Kiểm tra {len(bhs)} bản ghi burial_history...")
        fixed_count = 0

        for bh in bhs:
            needs_fix = False
            if not bh.proof_file_id:
                needs_fix = True
            else:
                fo = db.get(FileObject, bh.proof_file_id)
                if not fo:
                    needs_fix = True
                elif fo.mime_type == "application/pdf" or fo.file_name.lower().endswith(".pdf"):
                    needs_fix = True

            if needs_fix:
                plot = db.get(Plot, bh.plot_id)
                dec = db.get(DeceasedProfile, bh.deceased_id) if bh.deceased_id else None
                plot_code = plot.plot_code if plot else f"PLOT-{bh.plot_id}"
                dec_name = dec.full_name if dec else "Người Quá Cố"

                action_label = "Nghi Thức An Táng" if bh.action_type == "BURIED" else "Nghi Thức Cải Táng"
                title = f"LỄ AN TÁNG TÔN NGHIÊM - {dec_name.upper()}"
                subtitle = f"Vị trí an táng: {plot_code} (Slot #{bh.slot_id or 1})"

                img_bytes = generate_ceremony_image(
                    title=title,
                    subtitle=subtitle,
                    location_code=plot_code,
                    action_label=action_label,
                    accent_color=(16, 185, 129),
                )

                file_name = f"an_tang_{plot_code}_{bh.history_id}.jpg"
                from app.modules.documents.service import DocumentService
                new_fo = DocumentService.upload_file(
                    db=db,
                    file_name=file_name,
                    content=img_bytes,
                    user_id=bh.performed_by or 1,
                )

                bh.proof_file_id = new_fo.file_id
                bh.proof_url = f"/api/v1/documents/public/{new_fo.file_id}"
                fixed_count += 1
                if fixed_count % 10 == 0:
                    print(f"  + Đã tạo ảnh minh chứng thực địa cho {fixed_count} bản ghi an táng...")

        db.commit()
        print(f"Hoàn thành! Đã tạo và gắn ảnh minh chứng thực địa chuẩn JPEG cho {fixed_count} bản ghi an táng.")
    finally:
        db.close()


if __name__ == "__main__":
    fix_all_burial_evidence_photos()
