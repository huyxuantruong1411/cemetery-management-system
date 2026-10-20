"""
Script to enrich 60+ occupied plots with realistic multi-year lifecycle events and rich media:
- Ensures slots and deceased profiles exist for public lookup
- Burial ceremony with photo evidence
- Construction orders with 3-4 completed tasks and real photos
- Periodic care schedules across 2022-2026 with checklist items and real photos
- Uploads images to MinIO and registers FileObjects in database
"""
import sys
import os
import io
import hashlib
from datetime import datetime, timezone, date
from PIL import Image, ImageDraw

sys.path.insert(0, ".")
import app.main  # noqa: F401
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.documents.models import FileObject
from app.modules.plots.models import Plot, BurialHistory, PlotSlot
from app.modules.profiles.models import DeceasedProfile
from app.modules.contracts.models import Contract, ContractAnnex, CareAnnex, ConstructionAnnex
from app.modules.construction.models import ConstructionOrder, ConstructionTask, ConstructionTaskEvidence
from app.modules.care.models import CareSchedule, CareChecklistItem, CareMediaEvidence, CarePackage
from app.storage.minio_adapter import storage_adapter

SAMPLE_IMG_SOURCE = r"d:\work\TH-PTTK\QL-NghiaTrang\Test\asset\d2a4315f7c5a95d19fdd2807f5065745.jpg"

VIETNAMESE_NAMES = [
    ("Cụ Ông", "Nguyễn Văn Hùng", "MALE", 1935, date(2021, 4, 12)),
    ("Cụ Bà", "Trần Thị Mai", "FEMALE", 1938, date(2021, 8, 25)),
    ("Cụ Ông", "Lê Đình Phúc", "MALE", 1940, date(2022, 1, 15)),
    ("Cụ Bà", "Phạm Thị Ánh Tuyết", "FEMALE", 1943, date(2022, 5, 20)),
    ("Cụ Ông", "Hoàng Minh Trí", "MALE", 1945, date(2022, 9, 8)),
    ("Cụ Bà", "Vũ Thị Nguyệt", "FEMALE", 1948, date(2022, 11, 30)),
    ("Ông", "Đỗ Bá Đạt", "MALE", 1952, date(2023, 2, 14)),
    ("Bà", "Bùi Thị Hồng Nhung", "FEMALE", 1955, date(2023, 6, 18)),
    ("Cụ Ông", "Đặng Văn Lâm", "MALE", 1936, date(2023, 10, 5)),
    ("Cụ Bà", "Hồ Thị Kim Cúc", "FEMALE", 1939, date(2024, 1, 22)),
    ("Ông", "Ngô Quốc Bảo", "MALE", 1958, date(2024, 4, 30)),
    ("Bà", "Dương Thu Thủy", "FEMALE", 1960, date(2024, 7, 19)),
    ("Cụ Ông", "Lý Gia Thành", "MALE", 1942, date(2024, 11, 11)),
    ("Cụ Bà", "Phan Thị Ngọc Diệp", "FEMALE", 1946, date(2025, 2, 28)),
    ("Ông", "Võ Thành Trung", "MALE", 1954, date(2025, 5, 16)),
    ("Bà", "Trịnh Hoài An", "FEMALE", 1957, date(2025, 8, 24)),
    ("Cụ Ông", "Đinh Hữu Phước", "MALE", 1937, date(2025, 12, 10)),
    ("Cụ Bà", "Mai Thanh Huyền", "FEMALE", 1941, date(2026, 3, 15)),
]

THEME_PALETTES = [
    {
        "stage": "Lễ An Táng & Nghi Thức Hạ Huyệt",
        "bg_top": (28, 56, 46),
        "bg_bottom": (18, 38, 32),
        "accent": (212, 175, 55),
        "badge": "AN TÁNG THỰC ĐỊA",
        "category": "BURIAL"
    },
    {
        "stage": "Khảo Sát Hiện Trường & Cắm Mốc Tim",
        "bg_top": (55, 70, 85),
        "bg_bottom": (30, 42, 52),
        "accent": (245, 158, 11),
        "badge": "THI CÔNG - KHẢO SÁT",
        "category": "CONSTRUCTION"
    },
    {
        "stage": "Xây Móng Bê Tông & Ốp Đá Granite",
        "bg_top": (70, 48, 38),
        "bg_bottom": (40, 26, 20),
        "accent": (251, 191, 36),
        "badge": "THI CÔNG - ỐP ĐÁ GRANITE",
        "category": "CONSTRUCTION"
    },
    {
        "stage": "Lắp Đặt Bia Mộ & Phụ Kiện Tâm Linh",
        "bg_top": (38, 48, 68),
        "bg_bottom": (22, 28, 42),
        "accent": (56, 189, 248),
        "badge": "THI CÔNG - HOÀN THIỆN",
        "category": "CONSTRUCTION"
    },
    {
        "stage": "Chăm Sóc Định Kỳ: Dọn Cỏ & Thắp Hương",
        "bg_top": (26, 62, 45),
        "bg_bottom": (16, 40, 28),
        "accent": (74, 222, 128),
        "badge": "CHĂM SÓC ĐỊNH KỲ",
        "category": "CARE"
    },
    {
        "stage": "Lễ Tiết Thanh Minh & Dâng Hoa Tươi",
        "bg_top": (75, 40, 60),
        "bg_bottom": (45, 22, 35),
        "accent": (244, 114, 182),
        "badge": "ĐẠI LỄ TIẾT THANH MINH",
        "category": "CARE"
    },
    {
        "stage": "Đánh Bóng Bia Đá & Quét Rêu Phong",
        "bg_top": (40, 58, 68),
        "bg_bottom": (24, 38, 45),
        "accent": (34, 211, 238),
        "badge": "BẢO DƯỠNG KHUÔN VIÊN",
        "category": "CARE"
    },
]

def generate_evidence_image(title: str, subtitle: str, plot_code: str, date_str: str, theme_idx: int) -> bytes:
    theme = THEME_PALETTES[theme_idx % len(THEME_PALETTES)]
    w, h = 800, 600
    
    im = None
    if os.path.exists(SAMPLE_IMG_SOURCE):
        try:
            with Image.open(SAMPLE_IMG_SOURCE) as base_im:
                im = base_im.resize((w, h)).convert("RGB")
                tint = Image.new("RGB", (w, h), theme["bg_top"])
                im = Image.blend(im, tint, alpha=0.55)
        except Exception:
            im = None
            
    if im is None:
        im = Image.new("RGB", (w, h), color=theme["bg_top"])
        draw = ImageDraw.Draw(im)
        for y in range(h):
            ratio = y / h
            r = int(theme["bg_top"][0] * (1 - ratio) + theme["bg_bottom"][0] * ratio)
            g = int(theme["bg_top"][1] * (1 - ratio) + theme["bg_bottom"][1] * ratio)
            b = int(theme["bg_top"][2] * (1 - ratio) + theme["bg_bottom"][2] * ratio)
            draw.line([(0, y), (w, y)], fill=(r, g, b))
    else:
        draw = ImageDraw.Draw(im)
        
    accent = theme["accent"]
    draw.rectangle([(16, 16), (w - 17, h - 17)], outline=accent, width=2)
    draw.rectangle([(22, 22), (w - 23, h - 23)], outline=(255, 255, 255), width=1)
    
    # Header badge
    draw.rectangle([(40, 36), (340, 70)], fill=accent)
    draw.text((50, 46), theme["badge"], fill=(20, 20, 20))
    
    # Plot code pill
    draw.rectangle([(w - 250, 36), (w - 40, 70)], fill=(30, 41, 59), outline=accent, width=1)
    draw.text((w - 235, 46), f"Ô MỘ: {plot_code}", fill=(255, 255, 255))
    
    # Center Title banner
    draw.rectangle([(40, h // 2 - 70), (w - 40, h // 2 + 70)], fill=(15, 23, 42))
    draw.line([(40, h // 2 - 70), (w - 40, h // 2 - 70)], fill=accent, width=2)
    draw.line([(40, h // 2 + 70), (w - 40, h // 2 + 70)], fill=accent, width=2)
    
    draw.text((60, h // 2 - 45), title, fill=(255, 255, 255))
    draw.text((60, h // 2 - 12), subtitle, fill=(203, 213, 225))
    draw.text((60, h // 2 + 22), f"Thời gian thực địa: {date_str} • Ban Quản Lý Nghĩa Trang", fill=accent)
    
    # Footer timestamp & watermark
    draw.text((40, h - 48), "CHỨNG TỪ MINH CHỨNG SỐ HÓA - LƯU TRỮ VĨNH VIỄN", fill=(148, 163, 184))
    draw.text((w - 260, h - 48), f"MÃ KIỂM ĐỊNH: CM-{hashlib.md5((plot_code + title + date_str).encode()).hexdigest()[:8].upper()}", fill=(148, 163, 184))
    
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=88)
    return buf.getvalue()

def upload_and_create_file_object(db, file_bytes: bytes, file_name: str, uploader_id: int) -> str:
    file_id = hashlib.sha256(file_bytes).hexdigest()
    storage_path = f"evidences/{file_id[:2]}/{file_id[2:4]}/{file_id}.jpg"
    
    existing = db.query(FileObject).filter(FileObject.file_id == file_id).first()
    if not existing:
        storage_adapter.put_object(storage_path, file_bytes, "image/jpeg")
        fo = FileObject(
            file_id=file_id,
            bucket_name=getattr(storage_adapter, "bucket_name", "cemetery-documents"),
            object_key=storage_path,
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type="image/jpeg",
            sha256_hash=file_id,
            state="READY",
            uploaded_by_user_id=uploader_id
        )
        db.add(fo)
        db.flush()
    return file_id

def main():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
        admin_id = admin_user.user_id if admin_user else 1
        
        care_packages = db.query(CarePackage).filter(CarePackage.is_active.is_(True)).all()
        if not care_packages:
            print("No active care package found.")
            return

        occupied_plots = db.query(Plot).filter(Plot.status == "OCCUPIED").all()
        print(f"Total OCCUPIED plots: {len(occupied_plots)}")
        
        target_plots = occupied_plots[:60]
        enriched_count = 0
        total_photos_added = 0
        
        for idx, plot in enumerate(target_plots):
            plot_code = plot.plot_code
            
            # 1. Ensure Plot Slot and Deceased Profile exist
            slot = db.query(PlotSlot).filter(PlotSlot.plot_id == plot.plot_id).first()
            if not slot:
                slot = PlotSlot(
                    plot_id=plot.plot_id,
                    slot_number=1,
                    status="OCCUPIED"
                )
                db.add(slot)
                db.flush()
            else:
                slot.status = "OCCUPIED"
                
            deceased_id = slot.current_deceased_id
            if not deceased_id:
                # Pick or create a deceased profile
                sample_name = VIETNAMESE_NAMES[idx % len(VIETNAMESE_NAMES)]
                dec_code = f"DEC-{plot_code}-{idx:02d}"
                existing_dec = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_code == dec_code).first()
                if not existing_dec:
                    new_dec = DeceasedProfile(
                        deceased_code=dec_code,
                        full_name=f"{sample_name[0]} {sample_name[1]}",
                        gender=sample_name[2],
                        birth_year=sample_name[3],
                        date_of_birth=date(sample_name[3], 5, 10),
                        date_of_death=sample_name[4],
                        hometown="Hà Nội",
                        religion="Phật giáo",
                        has_death_certificate=True
                    )
                    db.add(new_dec)
                    db.flush()
                    deceased_id = new_dec.deceased_id
                else:
                    deceased_id = existing_dec.deceased_id
                    
                slot.current_deceased_id = deceased_id
                db.flush()

            # 2. Burial History
            burial = db.query(BurialHistory).filter(BurialHistory.plot_id == plot.plot_id).first()
            if not burial:
                b_date = datetime(2021 + (idx % 3), 3 + (idx % 8), 10 + (idx % 18), 9, 30, tzinfo=timezone.utc)
                b_date_str = b_date.strftime("%d/%m/%Y %H:%M")
                img_data = generate_evidence_image(
                    "LỄ AN TÁNG & HẠ HUYỆT THỰC ĐỊA",
                    f"Khuôn viên mộ phần {plot_code} - Nghi thức an táng tôn nghiêm",
                    plot_code,
                    b_date_str,
                    0
                )
                b_file_id = upload_and_create_file_object(db, img_data, f"an_tang_{plot_code}.jpg", admin_id)
                burial = BurialHistory(
                    plot_id=plot.plot_id,
                    slot_id=slot.slot_id,
                    deceased_id=deceased_id,
                    action_type="BURIED",
                    action_date=b_date,
                    proof_file_id=b_file_id,
                    performed_by=admin_id,
                    notes="An táng trang nghiêm, thân nhân đầy đủ."
                )
                db.add(burial)
                total_photos_added += 1
            elif not burial.proof_file_id:
                b_date_str = burial.action_date.strftime("%d/%m/%Y") if burial.action_date else "15/04/2022"
                img_data = generate_evidence_image(
                    "LỄ AN TÁNG & HẠ HUYỆT THỰC ĐỊA",
                    f"Khuôn viên mộ phần {plot_code} - Nghi thức trang nghiêm",
                    plot_code,
                    b_date_str,
                    0
                )
                b_file_id = upload_and_create_file_object(db, img_data, f"an_tang_{plot_code}.jpg", admin_id)
                burial.proof_file_id = b_file_id
                total_photos_added += 1
                
            # 3. Construction Order with Tasks and Evidence Photos
            const_order = db.query(ConstructionOrder).filter(ConstructionOrder.plot_id == plot.plot_id).first()
            if not const_order:
                contract = db.query(Contract).first()
                contract_id = contract.contract_id if contract else 1
                
                c_base_annex = ContractAnnex(
                    annex_code=f"PLTC-{plot_code}-{idx:02d}",
                    contract_id=contract_id,
                    annex_type="CONSTRUCTION",
                    status="ACTIVE",
                    valid_from=date(2022, 5, 1)
                )
                db.add(c_base_annex)
                db.flush()
                
                c_annex = ConstructionAnnex(
                    annex_id=c_base_annex.annex_id,
                    plot_id=plot.plot_id,
                    estimated_start_date=date(2022, 5, 5),
                    estimated_end_date=date(2022, 6, 25),
                    checklist_specifications="Xây dựng mộ phần theo thiết kế tiêu chuẩn."
                )
                db.add(c_annex)
                db.flush()
                
                const_order = ConstructionOrder(
                    annex_id=c_base_annex.annex_id,
                    plot_id=plot.plot_id,
                    status="COMPLETED",
                    start_date=date(2022, 5, 10),
                    expected_end_date=date(2022, 6, 25),
                    actual_end_date=date(2022, 6, 24),
                    overall_progress=100.00,
                    supervisor_id=admin_id,
                    notes=f"Hoàn thiện xây dựng mộ phần {plot_code} theo bản vẽ thiết kế tiêu chuẩn."
                )
                db.add(const_order)
                db.flush()
                
                tasks_spec = [
                    ("Khảo sát hiện trường & định vị tim mốc khuôn viên", 1, "05/05/2022", "Kỹ thuật viên đo trắc địa & cắm mốc ranh giới"),
                    ("Đổ móng bê tông & xây ốp đá Granite tự nhiên", 2, "20/05/2022", "Đá granite kim sa đen bóng, chống thấm rêu"),
                    ("Chế tác bia mộ đá hoa cương & nghiệm thu bàn giao", 3, "24/06/2022", "Chạm khắc chữ mạ vàng, hoàn thiện cảnh quan hoa viên")
                ]
                
                for t_name, theme_i, t_date, t_desc in tasks_spec:
                    t_img = generate_evidence_image(
                        f"THI CÔNG: {t_name}",
                        t_desc,
                        plot_code,
                        t_date,
                        theme_i
                    )
                    t_fid = upload_and_create_file_object(db, t_img, f"tc_{plot_code}_{theme_i}.jpg", admin_id)
                    total_photos_added += 1
                    
                    c_task = ConstructionTask(
                        order_id=const_order.order_id,
                        task_name=t_name,
                        status="DONE",
                        sort_order=theme_i,
                        is_required=True,
                        completed_at=datetime(2022, 5 + theme_i - 1, 20, 10, 0, tzinfo=timezone.utc),
                        completed_by=admin_id,
                        field_notes=t_desc
                    )
                    db.add(c_task)
                    db.flush()
                    
                    evidence = ConstructionTaskEvidence(
                        task_id=c_task.task_id,
                        file_id=t_fid,
                        uploaded_by=admin_id,
                        caption=f"Nghiệm thu: {t_name}"
                    )
                    db.add(evidence)
            
            # 4. Periodic Care Schedules spanning 2022 to 2026
            existing_care_count = db.query(CareSchedule).filter(CareSchedule.plot_id == plot.plot_id).count()
            if existing_care_count < 3:
                contract = db.query(Contract).first()
                contract_id = contract.contract_id if contract else 1
                
                years_to_add = [2022, 2023, 2024, 2025, 2026]
                for yr_idx, yr in enumerate(years_to_add):
                    pkg = care_packages[yr_idx % len(care_packages)]
                    s_date = date(yr, 3 + (yr_idx * 2) % 9, 15)
                    s_date_str = s_date.strftime("%d/%m/%Y")
                    
                    care_base_annex = ContractAnnex(
                        annex_code=f"PLCS-{plot_code}-{yr}-{idx:02d}",
                        contract_id=contract_id,
                        annex_type="CARE",
                        status="ACTIVE",
                        valid_from=date(yr, 1, 1)
                    )
                    db.add(care_base_annex)
                    db.flush()
                    
                    care_annex = CareAnnex(
                        annex_id=care_base_annex.annex_id,
                        package_id=pkg.package_id,
                        cycle_months=12,
                        recurring_price=1200000
                    )
                    db.add(care_annex)
                    db.flush()
                    
                    schedule = CareSchedule(
                        care_annex_id=care_base_annex.annex_id,
                        plot_id=plot.plot_id,
                        package_id=pkg.package_id,
                        caretaker_id=admin_id,
                        scheduled_date=s_date,
                        performed_date=datetime(yr, s_date.month, s_date.day, 10, 15, tzinfo=timezone.utc),
                        status="CLOSED",
                        closed_at=datetime(yr, s_date.month, s_date.day, 11, 0, tzinfo=timezone.utc),
                        period_key=f"{yr}-M{s_date.month:02d}",
                        notes=f"Đợt chăm sóc bảo dưỡng định kỳ năm {yr}: Lau dọn bia mộ, dọn cỏ khuôn viên, thắp hương và dâng hoa tươi."
                    )
                    db.add(schedule)
                    db.flush()
                    
                    # 2 Checklist items
                    chk1 = CareChecklistItem(
                        schedule_id=schedule.schedule_id,
                        task_description="Quét dọn rác, cắt tỉa cỏ và lau chùi bia đá Granite",
                        is_completed=True,
                        is_required=True,
                        sort_order=1,
                        field_notes="Đã hoàn thành sạch sẽ, sạch cỏ và bụi bẩn"
                    )
                    chk2 = CareChecklistItem(
                        schedule_id=schedule.schedule_id,
                        task_description="Thắp 3 nén hương thơm và cắm hoa cúc vàng tươi",
                        is_completed=True,
                        is_required=True,
                        sort_order=2,
                        field_notes="Hoa tươi cắm đầy đủ bình hoa hai bên mộ"
                    )
                    db.add(chk1)
                    db.add(chk2)
                    
                    # Media Evidences
                    theme_c = 4 if yr % 2 == 0 else 5
                    c_img = generate_evidence_image(
                        f"CHĂM SÓC ĐỊNH KỲ NĂM {yr}",
                        f"Gói dịch vụ: {pkg.package_name} - Nghiệm thu hoàn tất thực địa",
                        plot_code,
                        s_date_str,
                        theme_c
                    )
                    c_fid = upload_and_create_file_object(db, c_img, f"care_{plot_code}_{yr}.jpg", admin_id)
                    total_photos_added += 1
                    
                    c_evidence = CareMediaEvidence(
                        schedule_id=schedule.schedule_id,
                        file_id=c_fid,
                        media_url=f"/api/v1/documents/public/{c_fid}",
                        uploaded_by_user_id=admin_id,
                        caption=f"Hình ảnh chăm sóc định kỳ năm {yr} ({pkg.package_name})"
                    )
                    db.add(c_evidence)
                    
            enriched_count += 1
            if enriched_count % 10 == 0:
                db.commit()
                print(f"Enriched {enriched_count} plots... Added {total_photos_added} photos so far.")
                
        db.commit()
        print(f"\nSUCCESS: Enriched {enriched_count} plots with a total of {total_photos_added} new real photos!")
    except Exception as e:
        db.rollback()
        print(f"Error enriching plots: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
