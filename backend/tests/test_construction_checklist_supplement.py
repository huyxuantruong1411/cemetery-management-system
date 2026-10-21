import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.contracts.models import ConstructionAnnex, Contract, ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.plots.models import Plot, PlotSlot, PlotType, Row, Zone

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_checklist_catalog_endpoint():
    token = get_admin_token()
    resp = client.get(
        "/api/v1/construction/checklist-catalog",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    catalog = resp.json()
    assert len(catalog) >= 12
    codes = [item["code"] for item in catalog]
    assert "TC-01" in codes
    assert "TC-06" in codes


def test_annex_checklist_immutability_and_supplementary_tasks():
    """
    Test:
    1. Base tasks imported from annex checklist cannot be deleted or renamed.
    2. Supplementary tasks from standard catalog can be added and deleted.
    3. Non-catalog supplementary tasks are rejected (400).
    4. Tasks with 5 images reject 6th image (400).
    """
    db = SessionLocal()
    token = get_admin_token()
    try:
        uid = uuid.uuid4().hex[:6]
        admin = db.query(User).filter(User.username == "admin").first()

        zone = Zone(zone_code=f"Z_{uid}", zone_name=f"Zone {uid}")
        db.add(zone)
        db.flush()
        row = Row(zone_id=zone.zone_id, row_code=f"R_{uid}")
        db.add(row)
        db.flush()
        ptype = PlotType(type_name=f"Type {uid}", length=Decimal("2.0"), width=Decimal("1.5"), default_slots=1)
        db.add(ptype)
        db.flush()
        plot = Plot(plot_code=f"P_{uid}", row_id=row.row_id, type_id=ptype.type_id, status="OWNED_EMPTY", is_kim_tinh=False, is_locked=False)
        db.add(plot)
        db.flush()
        slot = PlotSlot(plot_id=plot.plot_id, slot_number=1, status="EMPTY")
        db.add(slot)
        db.flush()

        from app.modules.profiles.models import Customer
        customer = Customer(customer_code=f"KH_{uid}", full_name=f"Khach {uid}", citizen_id=f"12345{uid}", phone_number=f"091{uid}", address="HCM")
        db.add(customer)
        db.flush()

        contract = Contract(contract_code=f"HD_{uid}", contract_type="LAND_PURCHASE", customer_id=customer.customer_id, total_amount=Decimal("50000000"), status="ACTIVE", created_by_user_id=admin.user_id)
        db.add(contract)
        db.flush()

        annex = ContractAnnex(contract_id=contract.contract_id, annex_code=f"PL_{uid}", annex_type="CONSTRUCTION", valid_from=date.today(), status="ACTIVE", additional_amount=Decimal("10000000"))
        db.add(annex)
        db.flush()

        # Structured annex checklist
        import json
        specs_json = json.dumps([
            {"task_name": "Khảo sát hiện trường & định vị tim mốc khuôn viên ô mộ", "specs": "Đo đạc thực địa", "is_required": True},
            {"task_name": "Đào móng & đổ bê tông lót nền móng", "specs": "Mác M250", "is_required": True},
        ], ensure_ascii=False)

        const_annex = ConstructionAnnex(
            annex_id=annex.annex_id,
            plot_id=plot.plot_id,
            checklist_specifications=specs_json,
            estimated_start_date=date.today(),
            estimated_end_date=date.today() + timedelta(days=15),
        )
        db.add(const_annex)
        db.commit()

        # 1. Create order: tasks should automatically populate from annex
        order_resp = client.post(
            "/api/v1/construction/orders",
            json={
                "annex_id": annex.annex_id,
                "plot_id": plot.plot_id,
                "supervisor_id": admin.user_id,
                "expected_end_date": str(date.today() + timedelta(days=15)),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert order_resp.status_code == 201
        order = order_resp.json()
        order_id = order["order_id"]
        tasks = order["tasks"]
        assert len(tasks) == 2
        base_task = tasks[0]
        assert "[Theo phụ lục]" in (base_task.get("field_notes") or "")

        # 2. Attempt to delete base task -> MUST FAIL with 400
        del_base_resp = client.delete(
            f"/api/v1/construction/orders/{order_id}/tasks/{base_task['task_id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_base_resp.status_code == 400
        assert "cố định" in del_base_resp.json()["detail"].lower()

        # 3. Attempt to rename base task -> MUST FAIL with 400
        ren_base_resp = client.put(
            f"/api/v1/construction/tasks/{base_task['task_id']}",
            json={"task_name": "Đổi tên tùy tiện"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert ren_base_resp.status_code == 400
        assert "cố định" in ren_base_resp.json()["detail"].lower()

        # 4. Attempt to add supplementary task NOT in catalog -> MUST FAIL with 400
        bad_task_resp = client.post(
            f"/api/v1/construction/orders/{order_id}/tasks",
            json={
                "task_name": "Hạng mục bịa đặt không có trong danh mục kỹ thuật",
                "is_required": False,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert bad_task_resp.status_code == 400
        assert "danh mục quy chuẩn kỹ thuật" in bad_task_resp.json()["detail"].lower()

        # 5. Add valid supplementary task from catalog -> MUST SUCCEED
        good_task_resp = client.post(
            f"/api/v1/construction/orders/{order_id}/tasks",
            json={
                "task_name": "Thi công chống thấm sika & xử lý khe co giãn hố mộ",
                "is_required": False,
                "field_notes": "Xử lý bổ sung do nền đất trũng",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert good_task_resp.status_code == 201
        supp_task = good_task_resp.json()
        assert "[Bổ sung thực địa]" in (supp_task.get("field_notes") or "")

        # 6. Delete the supplementary task -> MUST SUCCEED
        del_supp_resp = client.delete(
            f"/api/v1/construction/orders/{order_id}/tasks/{supp_task['task_id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_supp_resp.status_code == 200

        # 7. Test max 5 images evidence limit
        # Create 5 images
        for i in range(5):
            f_id = f"test_img_{uid}_{i}"
            f_obj = FileObject(
                file_id=f_id,
                bucket_name="nghiatrang-private",
                object_key=f"uploads/{f_id}.jpg",
                file_name=f"img_{i}.jpg",
                mime_type="image/jpeg",
                file_size_bytes=1000,
                sha256_hash=f"{i}" * 64,
                state="READY",
            )
            db.add(f_obj)
        db.commit()

        for i in range(5):
            ev_resp = client.post(
                f"/api/v1/construction/tasks/{base_task['task_id']}/evidences",
                json={"file_id": f"test_img_{uid}_{i}", "caption": f"Ảnh {i+1}"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert ev_resp.status_code == 201

        # Attempt to upload 6th image -> MUST FAIL with 400
        f_id_6 = f"test_img_{uid}_6"
        f_obj_6 = FileObject(
            file_id=f_id_6,
            bucket_name="nghiatrang-private",
            object_key=f"uploads/{f_id_6}.jpg",
            file_name="img_6.jpg",
            mime_type="image/jpeg",
            file_size_bytes=1000,
            sha256_hash="6" * 64,
            state="READY",
        )
        db.add(f_obj_6)
        db.commit()

        ev_6_resp = client.post(
            f"/api/v1/construction/tasks/{base_task['task_id']}/evidences",
            json={"file_id": f_id_6, "caption": "Ảnh thứ 6"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert ev_6_resp.status_code == 400
        assert "tối đa 5 ảnh" in ev_6_resp.json()["detail"].lower()

    finally:
        db.close()
