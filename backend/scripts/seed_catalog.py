import json
import os
import sys
from datetime import date
from decimal import Decimal

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.modules.care.models import CarePackage
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.contracts.models import ContractTemplate


def seed_catalog():
    db = SessionLocal()
    print(
        "🌱 Bắt đầu nạp dữ liệu danh mục mẫu (Catalog, Pricing, Care Packages & Contract Templates)..."
    )

    try:
        # 1. Seed Contract Templates (4 mã chuẩn + 1 phụ lục)
        templates_data = [
            {
                "template_code": "HDMB-LAND-2026",
                "contract_type": "LAND_PURCHASE",
                "template_name": "Hợp đồng Mua bán Quyền Sử dụng Đất Nghĩa trang (Mẫu 2026)",
                "version_no": 1,
                "content_html": """
                <h2>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
                <p><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
                <hr/>
                <h3>HỢP ĐỒNG MUA BÁN QUYỀN SỬ DỤNG ĐẤT NGHĨA TRANG</h3>
                <p>Căn cứ quy chế hoạt động của Công viên Nghĩa trang Tư nhân;</p>
                <p>Bên A (Bên bán): Ban Quản Lý Công Viên Nghĩa Trang</p>
                <p>Bên B (Bên mua): Khách hàng đăng ký quyền sử dụng lâu dài</p>
                <p><strong>Điều 1: Đối tượng hợp đồng:</strong> Quyền sử dụng ô mộ tại phân khu đã chọn, phục vụ mục đích an táng tôn nghiêm.</p>
                <p><strong>Điều 2: Tính chất Kim Tĩnh:</strong> Khi đã tiến hành an táng theo hình thức Kim Tĩnh, vị trí ô mộ bị khóa vĩnh viễn, không thể chuyển đổi hoặc cải táng tùy tiện.</p>
                <p><strong>Điều 3: Thanh toán & Bàn giao:</strong> Bên B cam kết thanh toán đủ nghĩa vụ theo bảng giá ban hành.</p>
                """,
                "required_documents_json": json.dumps(["CITIZEN_ID"]),
                "is_active": True,
            },
            {
                "template_code": "PLDV-BURIAL-2026",
                "contract_type": "CARE_ANNEX",
                "template_name": "Phụ lục Dịch vụ An táng và Mai táng Tiêu chuẩn",
                "version_no": 1,
                "content_html": """
                <h3>PHỤ LỤC DỊCH VỤ AN TÁNG VÀ MAI TÁNG</h3>
                <p>Ràng buộc pháp lý bắt buộc: Phải xuất trình Giấy báo tử / Trích lục khai tử hợp lệ trước khi thi công huyệt mộ và an táng.</p>
                <p>Nghi thức tôn nghiêm: Đội tiêu binh và quản trang chịu trách nhiệm điều phối an táng đúng giờ lành đã đăng ký.</p>
                """,
                "required_documents_json": json.dumps(["DEATH_CERTIFICATE", "CITIZEN_ID"]),
                "is_active": True,
            },
            {
                "template_code": "HDBT-EXHUMATION-2026",
                "contract_type": "EXHUMATION",
                "template_name": "Hợp đồng Dịch vụ Cải táng và Di dời Hài cốt",
                "version_no": 1,
                "content_html": """
                <h3>HỢP ĐỒNG DỊCH VỤ CẢI TÁNG VÀ DI DỜI HÀI CỐT</h3>
                <p>Điều khoản an toàn: Tuân thủ quy định vệ sinh dịch tễ môi trường, thời gian cải táng tối thiểu theo quy định.</p>
                """,
                "required_documents_json": json.dumps(
                    ["DEATH_CERTIFICATE", "EXHUMATION_PERMIT", "CITIZEN_ID"]
                ),
                "is_active": True,
            },
            {
                "template_code": "HDHT-CREMATION-2026",
                "contract_type": "CREMATION",
                "template_name": "Hợp đồng Dịch vụ Hỏa táng và Lưu tro cốt",
                "version_no": 1,
                "content_html": """
                <h3>HỢP ĐỒNG DỊCH VỤ HỎA TÁNG VÀ LƯU TRO CỐT</h3>
                <p>Cam kết công nghệ: Sử dụng lò hỏa táng công nghệ cao, bàn giao tro cốt nguyên vẹn trang trọng.</p>
                """,
                "required_documents_json": json.dumps(["DEATH_CERTIFICATE", "CITIZEN_ID"]),
                "is_active": True,
            },
            {
                "template_code": "HDCN-TRANSFER-2026",
                "contract_type": "TRANSFER",
                "template_name": "Hợp đồng Chuyển nhượng Quyền Sử dụng Ô mộ Chưa Sử dụng",
                "version_no": 1,
                "content_html": """
                <h3>HỢP ĐỒNG CHUYỂN NHƯỢNG QUYỀN SỬ DỤNG Ô MỘ</h3>
                <p>Điều kiện chuyển nhượng: Chỉ áp dụng đối với ô mộ còn trống (EMPTY_UNSOLD / RESERVED) chưa an táng người mất.</p>
                """,
                "required_documents_json": json.dumps(["CITIZEN_ID", "ORIGINAL_CONTRACT"]),
                "is_active": True,
            },
        ]

        for td in templates_data:
            tmpl = (
                db.query(ContractTemplate)
                .filter(ContractTemplate.template_code == td["template_code"])
                .first()
            )
            if not tmpl:
                tmpl = ContractTemplate(**td)
                db.add(tmpl)
                print(f"  + Tạo Contract Template: {td['template_code']} - {td['template_name']}")
            else:
                tmpl.template_name = td["template_name"]
                tmpl.content_html = td["content_html"]
                tmpl.required_documents_json = td["required_documents_json"]
        db.commit()

        # 2. Seed Care Packages (3 gói chuẩn)
        care_packages_data = [
            {
                "package_code": "GOI-CS-THANG",
                "package_name": "Gói Chăm Sóc Mộ Định Kỳ Hàng Tháng (Cơ Bản)",
                "cycle_type": "MONTHLY",
                "unit_price": Decimal("350000.00"),
                "default_tasks_json": json.dumps(
                    [
                        "Dọn cỏ dại và thu gom rác quanh khuôn viên mộ",
                        "Lau sạch bia đá hoa cương và bề mặt mộ",
                        "Thắp hương vào ngày rằm (15) và mùng một (01) âm lịch hàng tháng",
                        "Chụp ảnh hiện trạng gửi gia đình qua ứng dụng di động",
                    ]
                ),
                "is_active": True,
            },
            {
                "package_code": "GOI-CS-QUY",
                "package_name": "Gói Chăm Sóc & Hoa Viên Theo Quý (Nâng Cao)",
                "cycle_type": "QUARTERLY",
                "unit_price": Decimal("1200000.00"),
                "default_tasks_json": json.dumps(
                    [
                        "Toàn bộ các hạng mục chăm sóc định kỳ hàng tháng",
                        "Cắt tỉa, tạo tán cây cảnh và thay hoa tươi tại bồn hoa khuôn viên",
                        "Đánh bóng bia đá granite và vệ sinh mạch nối kim tĩnh",
                        "Dâng mâm quả lễ vào các ngày sóc vọng và lễ tiết",
                    ]
                ),
                "is_active": True,
            },
            {
                "package_code": "GOI-CS-NAM",
                "package_name": "Gói Chăm Sóc Toàn Diện & Đại Lễ Hàng Năm (VIP)",
                "cycle_type": "YEARLY",
                "unit_price": Decimal("4500000.00"),
                "default_tasks_json": json.dumps(
                    [
                        "Toàn bộ các hạng mục chăm sóc theo tháng và theo quý",
                        "Tổng vệ sinh và bảo dưỡng kết cấu đá khuôn viên trước Tết Nguyên Đán",
                        "Phục hồi chữ khắc nhũ vàng / thếp vàng trên bia mộ khi có dấu hiệu phai mờ",
                        "Tổ chức cúng giỗ gia tiên và đại lễ Vu Lan Báo Hiếu",
                        "Báo cáo nghiệm thu hình ảnh 360 độ lưu trữ hệ thống MinIO",
                    ]
                ),
                "is_active": True,
            },
        ]

        for pkg_data in care_packages_data:
            pkg = (
                db.query(CarePackage)
                .filter(CarePackage.package_code == pkg_data["package_code"])
                .first()
            )
            if not pkg:
                pkg = CarePackage(**pkg_data)
                db.add(pkg)
                print(
                    f"  + Tạo Care Package: {pkg_data['package_code']} - {pkg_data['package_name']}"
                )
            else:
                pkg.package_name = pkg_data["package_name"]
                pkg.unit_price = pkg_data["unit_price"]
                pkg.default_tasks_json = pkg_data["default_tasks_json"]
        db.commit()

        # 3. Seed Price List & Price Items (Bảng giá 2026)
        pl_name = "Bảng Giá Dịch Vụ Nghĩa Trang Niêm Yết 2026"
        pl = db.query(PriceList).filter(PriceList.price_list_name == pl_name).first()
        if not pl:
            pl = PriceList(
                price_list_name=pl_name,
                effective_from_date=date(2026, 1, 1),
                effective_to_date=None,  # Vô thời hạn
                is_active=True,
            )
            db.add(pl)
            db.flush()
            print(f"  + Tạo Price List: {pl_name}")

        items_data = [
            (
                "GIA-DAT-DON",
                "Đơn giá chuyển nhượng ô mộ đơn tiêu chuẩn",
                Decimal("120000000.00"),
                "ô mộ",
                None,
            ),
            (
                "GIA-DAT-DOI",
                "Đơn giá chuyển nhượng ô mộ đôi song thân",
                Decimal("250000000.00"),
                "ô mộ",
                None,
            ),
            (
                "GIA-DAT-GIA-TOC",
                "Đơn giá khuôn viên hoa viên gia tộc VIP",
                Decimal("650000000.00"),
                "khuôn viên",
                None,
            ),
            (
                "DV-XAY-KIMTINH",
                "Chi phí thi công đúc khối kim tĩnh bê tông cốt thép",
                Decimal("18000000.00"),
                "hố mộ",
                "CONSTRUCTION",
            ),
            (
                "DV-ANTANG",
                "Dịch vụ nghi thức hạ huyệt an táng tiêu chuẩn",
                Decimal("6000000.00"),
                "lượt",
                "BURIAL",
            ),
            (
                "DV-CAITANG",
                "Dịch vụ bốc mộ cải táng sang tiểu quách",
                Decimal("12000000.00"),
                "lượt",
                "EXHUMATION",
            ),
            (
                "DV-HOATANG",
                "Dịch vụ hỏa táng nguyên vẹn công nghệ châu Âu",
                Decimal("8500000.00"),
                "lượt",
                "CREMATION",
            ),
        ]

        for item_code, item_name, unit_price, unit, service_code in items_data:
            it = (
                db.query(PriceItem)
                .filter(
                    PriceItem.price_list_id == pl.price_list_id, PriceItem.item_code == item_code
                )
                .first()
            )
            if not it:
                it = PriceItem(
                    price_list_id=pl.price_list_id,
                    item_code=item_code,
                    item_name=item_name,
                    unit_price=unit_price,
                    unit=unit,
                    service_code=service_code,
                )
                db.add(it)
                print(
                    f"    - Thêm Price Item: [{item_code}] {item_name}: {unit_price:,.0f} VNĐ / {unit}"
                )
            else:
                it.unit_price = unit_price
                it.item_name = item_name
        db.commit()

        print("✅ Nạp dữ liệu danh mục thành công 100%!")
    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi nạp danh mục: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_catalog()
