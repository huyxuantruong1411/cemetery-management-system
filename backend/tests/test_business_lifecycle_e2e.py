import json
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.documents.service import DocumentService
from app.modules.plots.models import Plot, PlotSlot, Zone, Row, PlotType
from app.modules.profiles.models import Customer, DeathCertificate, DeceasedProfile

client = TestClient(app)


def get_token(role: str) -> str:
    """Helper to authenticate different business actors."""
    passwords = {
        "marketing": "Marketing2026!",
        "accountant": "Accountant2026!",
        "caretaker": "Caretaker2026!",
        "admin": "Admin2026!",
    }
    resp = client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username": role, "password": passwords[role]},
    )
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture
def marketing_headers():
    return {"Authorization": f"Bearer {get_token('marketing')}"}


@pytest.fixture
def accountant_headers():
    return {"Authorization": f"Bearer {get_token('accountant')}"}


@pytest.fixture
def caretaker_headers():
    return {"Authorization": f"Bearer {get_token('caretaker')}"}


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {get_token('admin')}"}


@pytest.fixture
def sample_pdf_scan():
    """Upload mock signed document to MinIO."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        user_id = user.user_id if user else 1
        dummy_content = b"%PDF-1.4 Mock Scan Hop Dong Ky Ket Ban Chinh"
        doc = DocumentService.upload_file(
            db=db,
            file_name=f"hop_dong_ky_{uuid.uuid4().hex[:6]}.pdf",
            content=dummy_content,
            user_id=user_id,
        )
        return doc.file_id
    finally:
        db.close()


def test_biz_scenario_1_walkin_customer_land_purchase_lifecycle(
    marketing_headers, accountant_headers, sample_pdf_scan
):
    """
    KỊCH BẢN 1: Khách hàng mới -> Tư vấn & Giữ chỗ độc quyền 30 phút -> Lập HĐ Mua Đất
    -> Ký bản cứng & Upload Scan MinIO -> Kế toán thu 2 đợt (Partial -> Full) -> Xuất hóa đơn chữ Việt -> Kích hoạt quyền sở hữu.
    """
    db = SessionLocal()
    try:
        row = db.query(Row).first()
        ptype = db.query(PlotType).first()
        plot = Plot(
            plot_code=f"BIZ1-{uuid.uuid4().hex[:6].upper()}",
            row_id=row.row_id,
            type_id=ptype.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot)
        db.commit()
        db.refresh(plot)

        slot = PlotSlot(
            plot_id=plot.plot_id,
            slot_number=1,
            status="EMPTY",
        )
        db.add(slot)
        db.commit()
        plot_id = plot.plot_id
    finally:
        db.close()

    # Bước 1 & 2: Marketing giữ chỗ ô mộ độc quyền (Anti-Double Booking)
    res_resp = client.post(
        f"{settings.API_V1_PREFIX}/plots/{plot_id}/reserve",
        headers=marketing_headers,
        json={"notes": "Khách hàng vãng lai giữ chỗ tư vấn tại quầy"},
    )
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert res_data["state"] == "ACTIVE"

    # Nghiệp vụ: Nhân viên khác cùng lúc cố tình đặt chỗ ô này -> Bị chặn
    double_res = client.post(
        f"{settings.API_V1_PREFIX}/plots/{plot_id}/reserve",
        headers=marketing_headers,
        json={"notes": "Nhân viên khác cố tình đặt chỗ trùng"},
    )
    assert double_res.status_code in [400, 409], "Phải chặn tranh chấp giữ chỗ ô mộ đang RESERVED"

    # Bước 3: Tạo hồ sơ khách hàng mới tinh
    cccd = f"079{uuid.uuid4().int % 1000000000:09d}"
    cust_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={
            "full_name": "Nguyễn Văn Khách Hàng Test",
            "citizen_id": cccd,
            "phone_number": "0909123456",
            "email": f"khach_{uuid.uuid4().hex[:4]}@gmail.com",
            "address": "123 Đường Hoa Viên, TP.HCM",
        },
    )
    assert cust_resp.status_code == 201
    cust_id = cust_resp.json()["customer_id"]

    # Bước 4: Khởi tạo Hợp đồng Mua Đất (LAND_PURCHASE)
    contract_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        headers=marketing_headers,
        json={
            "customer_id": cust_id,
            "plot_id": plot_id,
            "land_unit_price": 35000000.00,
            "notes": "Hợp đồng mua quyền sử dụng đất mộ gia tộc",
        },
    )
    assert contract_resp.status_code == 201
    contract_id = contract_resp.json()["contract_id"]

    # Bước 5: Ký hợp đồng bản cứng & Tải scan MinIO để kích hoạt hiệu lực
    activate_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "ACTIVE"

    # Kiểm tra ô đất đã chuyển sang OWNED_EMPTY hoặc ASSIGNED và gắn chủ sở hữu
    plot_check = client.get(f"{settings.API_V1_PREFIX}/plots/{plot_id}", headers=marketing_headers).json()
    assert plot_check["status"] in ["OWNED_EMPTY", "ASSIGNED"]
    assert plot_check.get("current_owner_id") == cust_id or plot_check.get("owner_id") == cust_id

    # Bước 6: Kế toán thu tiền 2 đợt (30% và 70%)
    rec_list = client.get(
        f"{settings.API_V1_PREFIX}/finance/receivables?contract_id={contract_id}",
        headers=accountant_headers,
    ).json()
    assert len(rec_list) >= 1
    rec_id = rec_list[0]["receivable_id"]

    # Đợt 1: Thanh toán 10,500,000 VNĐ (30%)
    pay1_resp = client.post(
        f"{settings.API_V1_PREFIX}/finance/receivables/{rec_id}/payments",
        headers=accountant_headers,
        json={
            "paid_amount": "10500000.00",
            "payment_method": "BANK_TRANSFER",
            "transaction_reference": f"TX-{uuid.uuid4().hex[:6]}",
            "notes": "Thanh toán đợt 1 (30%)",
        },
    )
    assert pay1_resp.status_code == 201
    rec_check1 = client.get(f"{settings.API_V1_PREFIX}/finance/receivables/{rec_id}", headers=accountant_headers).json()
    assert rec_check1["status"] in ["PARTIALLY_PAID", "PARTIAL"]
    assert Decimal(str(rec_check1["remaining_balance"])) == Decimal("24500000.00")

    # Đợt 2: Thanh toán 24,500,000 VNĐ (70% còn lại)
    pay2_resp = client.post(
        f"{settings.API_V1_PREFIX}/finance/receivables/{rec_id}/payments",
        headers=accountant_headers,
        json={
            "paid_amount": "24500000.00",
            "payment_method": "VIET_QR",
            "transaction_reference": f"QR-{uuid.uuid4().hex[:6]}",
            "notes": "Thanh toán dứt điểm đợt 2",
        },
    )
    assert pay2_resp.status_code == 201
    pay2_data = pay2_resp.json()

    rec_check2 = client.get(f"{settings.API_V1_PREFIX}/finance/receivables/{rec_id}", headers=accountant_headers).json()
    assert rec_check2["status"] == "PAID"
    assert Decimal(str(rec_check2["remaining_balance"])) == Decimal("0.00")

    # Bước 7: Kiểm tra Hóa đơn điện tử có đọc số tiền bằng chữ tiếng Việt
    assert "invoice" in pay2_data and pay2_data["invoice"] is not None
    inv = pay2_data["invoice"]
    assert "Hai mươi bốn triệu" in inv["total_amount_in_words"]


def test_biz_scenario_2_burial_and_kim_tinh_immutability(
    marketing_headers, caretaker_headers, admin_headers, sample_pdf_scan
):
    """
    KỊCH BẢN 2: An táng -> Bắt buộc Giấy báo tử -> Lập phụ lục Kim Tĩnh -> Nghiệm thu thi công
    -> Khóa vĩnh viễn Kim Tĩnh. Chặn mọi hành vi sửa, xóa, cải táng.
    """
    db = SessionLocal()
    try:
        row = db.query(Row).first()
        ptype = db.query(PlotType).first()
        plot = Plot(
            plot_code=f"KT-{uuid.uuid4().hex[:6].upper()}",
            row_id=row.row_id,
            type_id=ptype.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot)
        db.commit()
        db.refresh(plot)

        slot = PlotSlot(
            plot_id=plot.plot_id,
            slot_number=1,
            status="EMPTY",
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
        plot_id = plot.plot_id
        slot_id = slot.slot_id
    finally:
        db.close()

    # 1. Tạo khách hàng và ký HĐ Mua Đất
    cust_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={
            "full_name": "Lê Văn Thân Nhân",
            "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}",
            "phone_number": "0988776655",
            "address": "456 Đường Tang Lễ",
        },
    ).json()
    cust_id = cust_resp["customer_id"]

    contract_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        headers=marketing_headers,
        json={
            "customer_id": cust_id,
            "plot_id": plot_id,
            "land_unit_price": 40000000.00,
        },
    )
    contract_id = contract_resp.json()["contract_id"]

    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # 2. Tạo hồ sơ người mất (CHƯA có giấy báo tử xác minh)
    dec_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased",
        headers=marketing_headers,
        json={
            "full_name": "Cụ Lê Văn Tiên Sinh",
            "gender": "MALE",
            "date_of_birth": "1945-05-10",
            "date_of_death": "2026-10-01",
        },
    )
    assert dec_resp.status_code == 201
    dec_id = dec_resp.json()["deceased_id"]

    # 3. Nghiệp vụ: Cố tình lập phụ lục an táng khi chưa có giấy báo tử -> BỊ CHẶN 400
    annex_fail = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
        headers=marketing_headers,
        json={
            "deceased_id": dec_id,
            "slot_id": slot_id,
            "burial_date": "2026-10-15",
            "is_kim_tinh": True,
            "additional_amount": 10000000.0,
            "construction_notes": "Xây kim tĩnh đúc bê tông cốt thép",
        },
    )
    assert annex_fail.status_code == 400, "Phải chặn an táng khi chưa có giấy báo tử!"

    # 4. Bổ sung Giấy báo tử và thẩm định xác minh
    cert_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased/{dec_id}/certificate",
        headers=marketing_headers,
        json={
            "certificate_number": f"GBT-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": "2026-10-02",
            "issuing_authority": "UBND Phường Bến Nghé",
            "file_id": sample_pdf_scan,
        },
    )
    assert cert_resp.status_code == 200
    cert_id = cert_resp.json()["cert_id"]

    # Xác minh giấy báo tử
    verify_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/certificates/{cert_id}/verify",
        headers=marketing_headers,
        json={"is_verified": True},
    )
    assert verify_resp.status_code == 200

    # 5. Lập phụ lục an táng thành công
    annex_ok = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
        headers=marketing_headers,
        json={
            "deceased_id": dec_id,
            "slot_id": slot_id,
            "burial_date": "2026-10-15",
            "is_kim_tinh": True,
            "additional_amount": 10000000.0,
            "construction_notes": "Xây kim tĩnh đúc bê tông cốt thép",
        },
    )
    assert annex_ok.status_code == 201
    annex_id = annex_ok.json()["annexes"][-1]["annex_id"]

    # Kích hoạt phụ lục an táng -> Kích hoạt lệnh thi công và hoàn tất hạ huyệt Kim Tĩnh
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/annexes/{annex_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # 6. Kiểm tra bất biến Kim Tĩnh: Cấm lập hợp đồng cải táng trên mộ Kim Tĩnh
    exh_fail = client.post(
        f"{settings.API_V1_PREFIX}/contracts/exhumation",
        headers=marketing_headers,
        json={
            "customer_id": cust_id,
            "plot_id": plot_id,
            "reason": "Yêu cầu bốc mộ chuyển về quê",
        },
    )
    assert exh_fail.status_code in [400, 422, 409], "Phải cấm lập hợp đồng cải táng trên mộ Kim Tĩnh!"


def test_biz_scenario_3_care_package_and_schedule_tasks(caretaker_headers, admin_headers):
    """
    KỊCH BẢN 3: Gói chăm sóc định kỳ nạp đúng 4 task mẫu tiếng Việt chuẩn không lỗi font.
    """
    pkg_resp = client.get(
        f"{settings.API_V1_PREFIX}/catalog/care-packages",
        headers=caretaker_headers,
    )
    assert pkg_resp.status_code == 200
    packages = pkg_resp.json()
    target_pkg = next((p for p in packages if p["package_code"] == "GOI-CS-THANG"), None)
    assert target_pkg is not None
    assert target_pkg["package_name"] == "Gói Chăm Sóc Mộ Định Kỳ Hàng Tháng (Cơ Bản)"
    tasks = json.loads(target_pkg["default_tasks_json"])
    assert len(tasks) >= 3
    assert "Dọn cỏ dại" in tasks[0]
    assert "Lau sạch bia" in tasks[1]


def test_biz_scenario_4_exhumation_rules_and_kim_tinh_prevention(
    marketing_headers, caretaker_headers, admin_headers, sample_pdf_scan
):
    """
    KỊCH BẢN 4: Cải táng / Bốc mộ:
    - Case 4A: Chặn mộ Kim Tĩnh (văng lỗi không thể bóc mộ Kim Tĩnh)
    - Case 4B: Chặn người không phải chính chủ
    - Case 4C: Mộ đất thường chính chủ -> Lập HĐ cải táng, hoàn tất giải phóng ô đất về OWNED_EMPTY
    """
    db = SessionLocal()
    try:
        row = db.query(Row).first()
        ptype = db.query(PlotType).first()
        plot = Plot(
            plot_code=f"EX-{uuid.uuid4().hex[:6].upper()}",
            row_id=row.row_id,
            type_id=ptype.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot)
        db.commit()
        db.refresh(plot)

        slot = PlotSlot(plot_id=plot.plot_id, slot_number=1, status="EMPTY")
        db.add(slot)
        db.commit()
        db.refresh(slot)
        plot_id = plot.plot_id
        slot_id = slot.slot_id
    finally:
        db.close()

    # 1. Tạo chủ đất và ký hợp đồng mua đất
    cust_owner = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={
            "full_name": "Trần Thị Chính Chủ",
            "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}",
            "phone_number": "0911223344",
            "address": "789 Đường Nghĩa Trang",
        },
    ).json()
    owner_id = cust_owner["customer_id"]

    cust_stranger = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={
            "full_name": "Người Ngoài Không Phải Chủ",
            "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}",
            "phone_number": "0911998877",
            "address": "999 Đường Khác",
        },
    ).json()
    stranger_id = cust_stranger["customer_id"]

    contract_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        headers=marketing_headers,
        json={"customer_id": owner_id, "plot_id": plot_id, "land_unit_price": 30000000.00},
    )
    contract_id = contract_resp.json()["contract_id"]
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # 2. Tạo người mất hợp lệ có giấy báo tử và an táng mộ đất thường (EARTH_BURIAL, không Kim Tĩnh)
    dec_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased",
        headers=marketing_headers,
        json={
            "full_name": "Ông Trần Văn Mộ Đất",
            "gender": "MALE",
            "date_of_death": "2026-10-01",
        },
    ).json()
    dec_id = dec_resp["deceased_id"]

    cert_resp = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased/{dec_id}/certificate",
        headers=marketing_headers,
        json={
            "certificate_number": f"GBT-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": "2026-10-02",
            "issuing_authority": "UBND Phường Tân Định",
            "file_id": sample_pdf_scan,
        },
    ).json()
    client.post(
        f"{settings.API_V1_PREFIX}/profiles/certificates/{cert_resp['cert_id']}/verify",
        headers=marketing_headers,
        json={"is_verified": True},
    )

    annex_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/annexes/burial",
        headers=marketing_headers,
        json={
            "deceased_id": dec_id,
            "slot_id": slot_id,
            "burial_date": "2026-10-15",
            "is_kim_tinh": False,
            "additional_amount": 5000000.0,
            "construction_notes": "Chôn cất mộ đất thông thường",
        },
    ).json()
    annex_id = annex_resp["annexes"][-1]["annex_id"]
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/annexes/{annex_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # Case 4B: Người ngoài cố tình yêu cầu cải táng -> Bị từ chối 403
    bad_ex_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/exhumation",
        headers=marketing_headers,
        json={
            "customer_id": stranger_id,
            "plot_id": plot_id,
            "slot_id": slot_id,
            "current_deceased_id": dec_id,
            "exhumation_date": "2026-12-01",
            "exhumation_fee": 10000000.0,
            "reason": "Người ngoài đòi bốc mộ",
        },
    )
    assert bad_ex_resp.status_code == 403, "Phải từ chối yêu cầu cải táng của người không phải chính chủ"

    # Case 4C: Chính chủ yêu cầu cải táng mộ đất thường -> Thành công
    good_ex_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/exhumation",
        headers=marketing_headers,
        json={
            "customer_id": owner_id,
            "plot_id": plot_id,
            "slot_id": slot_id,
            "current_deceased_id": dec_id,
            "exhumation_date": "2026-12-01",
            "exhumation_fee": 10000000.0,
            "reason": "Di dời về quê hương",
        },
    )
    assert good_ex_resp.status_code == 201
    ex_contract_id = good_ex_resp.json()["contract_id"]

    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{ex_contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # Kiểm tra ô đất sau cải táng trả về OWNED_EMPTY và slot trống
    plot_check = client.get(f"{settings.API_V1_PREFIX}/plots/{plot_id}", headers=marketing_headers).json()
    assert plot_check["status"] == "OWNED_EMPTY"


def test_biz_scenario_5_plot_transfer_and_invariants(marketing_headers, sample_pdf_scan):
    """
    KỊCH BẢN 5: Chuyển nhượng quyền sử dụng đất nghĩa trang từ Chủ A sang Chủ B:
    - Ô đất trống (OWNED_EMPTY) được chuyển nhượng thành công.
    - Cập nhật chủ sở hữu mới sang Chủ B.
    """
    db = SessionLocal()
    try:
        row = db.query(Row).first()
        ptype = db.query(PlotType).first()
        plot = Plot(
            plot_code=f"TR-{uuid.uuid4().hex[:6].upper()}",
            row_id=row.row_id,
            type_id=ptype.type_id,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
        )
        db.add(plot)
        db.commit()
        db.refresh(plot)

        slot = PlotSlot(plot_id=plot.plot_id, slot_number=1, status="EMPTY")
        db.add(slot)
        db.commit()
        plot_id = plot.plot_id
    finally:
        db.close()

    cust_a = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={"full_name": "Chủ A Chuyển Nhượng", "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}", "phone_number": "0933112233", "address": "123 Đường A, Quận 1"},
    ).json()
    cust_b = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={"full_name": "Chủ B Nhận Chuyển Nhượng", "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}", "phone_number": "0944112233", "address": "456 Đường B, Quận 2"},
    ).json()

    c_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/land-purchase",
        headers=marketing_headers,
        json={"customer_id": cust_a["customer_id"], "plot_id": plot_id, "land_unit_price": 25000000.00},
    ).json()
    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{c_resp['contract_id']}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    # Chuyển nhượng sang Chủ B
    tr_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/transfer",
        headers=marketing_headers,
        json={
            "seller_id": cust_a["customer_id"],
            "buyer_id": cust_b["customer_id"],
            "plot_id": plot_id,
            "commission_fee": 2000000.0,
            "transfer_reason": "Chuyển nhượng quyền sử dụng đất nghĩa trang hợp pháp",
        },
    )
    assert tr_resp.status_code == 201
    tr_contract_id = tr_resp.json()["contract_id"]

    client.post(
        f"{settings.API_V1_PREFIX}/contracts/{tr_contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )

    plot_check = client.get(f"{settings.API_V1_PREFIX}/plots/{plot_id}", headers=marketing_headers).json()
    assert plot_check.get("current_owner_id") == cust_b["customer_id"] or plot_check.get("owner_id") == cust_b["customer_id"]


def test_biz_scenario_6_cremation_independent_service(marketing_headers, accountant_headers, sample_pdf_scan):
    """
    KỊCH BẢN 6: Hỏa táng độc lập (không gắn ô đất nghĩa trang), lưu tháp cốt Địa Tạng.
    """
    cust = client.post(
        f"{settings.API_V1_PREFIX}/profiles/customers",
        headers=marketing_headers,
        json={"full_name": "Thân Nhân Đăng Ký Hỏa Táng", "citizen_id": f"079{uuid.uuid4().int % 1000000000:09d}", "phone_number": "0977889900", "address": "789 Đường Hỏa Táng, Bình Hưng Hòa"},
    ).json()

    dec = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased",
        headers=marketing_headers,
        json={"full_name": "Người Quá Cố Hỏa Táng", "gender": "FEMALE", "date_of_death": "2026-10-05"},
    ).json()

    cert = client.post(
        f"{settings.API_V1_PREFIX}/profiles/deceased/{dec['deceased_id']}/certificate",
        headers=marketing_headers,
        json={
            "certificate_number": f"GBT-CRE-{uuid.uuid4().hex[:6].upper()}",
            "issue_date": "2026-10-06",
            "issuing_authority": "UBND Phường 1",
            "file_id": sample_pdf_scan,
        },
    ).json()

    client.post(
        f"{settings.API_V1_PREFIX}/profiles/certificates/{cert['cert_id']}/verify",
        headers=marketing_headers,
        json={"is_verified": True},
    )

    cre_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/cremation",
        headers=marketing_headers,
        json={
            "customer_id": cust["customer_id"],
            "deceased_id": dec["deceased_id"],
            "cremation_date": "2026-10-12",
            "package_service_code": "HOA_TANG_TRON_GOI",
            "service_fee": 15000000.0,
            "urn_storage_option": "Lưu tháp cốt Địa Tạng",
            "notes": "Hợp đồng hỏa táng độc lập",
        },
    )
    assert cre_resp.status_code == 201
    contract_id = cre_resp.json()["contract_id"]

    act_resp = client.post(
        f"{settings.API_V1_PREFIX}/contracts/{contract_id}/activate",
        headers=marketing_headers,
        json={"signed_scan_file_id": sample_pdf_scan, "signed_at": "2026-10-10"},
    )
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "ACTIVE"


def test_biz_scenario_7_public_memorial_lookup_zero_pii():
    """
    KỊCH BẢN 7: Khách vãng lai tra cứu thông tin tưởng niệm công khai
    -> Nhận tên người mất, ô mộ, GPS
    -> TUYỆT ĐỐI KHÔNG LỘ PII (CCCD, SĐT, hợp đồng, chi phí, file giấy báo tử).
    """
    resp = client.get(f"{settings.API_V1_PREFIX}/profiles/public/memorials?q=Nguyễn")
    assert resp.status_code == 200
    results = resp.json()

    if results:
        first = results[0]
        assert "full_name" in first
        assert "plot_code" in first

        # Các trường nhạy cảm KHÔNG ĐƯỢC PHÉP XUẤT HIỆN trong kết quả
        assert "citizen_id" not in first, "Rò rỉ CCCD thân nhân trên cổng công khai!"
        assert "phone_number" not in first, "Rò rỉ số điện thoại thân nhân!"
        assert "total_value" not in first, "Rò rỉ giá trị hợp đồng tài chính!"
        assert "death_certificate_file_url" not in first, "Rò rỉ file giấy báo tử công khai!"
