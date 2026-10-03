import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.contracts.models import Contract, ContractAnnex
from app.modules.documents.models import FileObject
from app.modules.plots.models import Plot, PlotSlot, PlotType, Row, Zone
from app.modules.profiles.models import Customer

client = TestClient(app)


def get_admin_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_caretaker_token() -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "caretaker", "password": "Caretaker2026!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def create_test_active_contract_and_annex(db: Session, annex_status: str = "ACTIVE"):
    uid = uuid.uuid4().hex[:6]

    # Zone, Row, PlotType
    zone = Zone(zone_code=f"ZC_{uid}", zone_name=f"Zone Constr {uid}")
    db.add(zone)
    db.flush()

    row = Row(zone_id=zone.zone_id, row_code=f"RC_{uid}")
    db.add(row)
    db.flush()

    ptype = PlotType(
        type_name=f"Type Constr {uid}",
        length=Decimal("2.50"),
        width=Decimal("1.50"),
        default_slots=1,
    )
    db.add(ptype)
    db.flush()

    # Customer
    customer = Customer(
        customer_code=f"KH-TC-{uid}",
        full_name=f"Khách Thi Công {uid}",
        citizen_id=f"079099{uid[:6]}",
        phone_number=f"0988{uid[:6]}",
        address="TP. Hồ Chí Minh",
    )
    db.add(customer)
    db.flush()

    # Plot
    plot = Plot(
        plot_code=f"PC_{uid}",
        row_id=row.row_id,
        type_id=ptype.type_id,
        status="OWNED_EMPTY",
        owner_id=customer.customer_id,
        is_kim_tinh=False,
        is_locked=False,
    )
    db.add(plot)
    db.flush()

    slot = PlotSlot(plot_id=plot.plot_id, slot_number=1, status="EMPTY")
    db.add(slot)
    db.flush()

    admin = db.query(User).filter(User.username == "admin").first()
    assert admin is not None

    # Contract
    contract = Contract(
        contract_code=f"HD-TC-{uid}",
        contract_type="LAND_PURCHASE",
        customer_id=customer.customer_id,
        total_amount=Decimal("100000000.00"),
        status="ACTIVE",
        created_by_user_id=admin.user_id,
    )
    db.add(contract)
    db.flush()

    # Annex
    annex = ContractAnnex(
        contract_id=contract.contract_id,
        annex_code=f"PL-XD-{uid}",
        annex_type="CONSTRUCTION",
        valid_from=date.today(),
        status=annex_status,
        additional_amount=Decimal("25000000.00"),
    )
    db.add(annex)
    db.commit()
    db.refresh(annex)
    db.refresh(plot)
    return annex, plot, customer


def test_create_order_rejected_if_annex_not_active():
    """Gate: Hủy/chưa ACTIVE phụ lục không được phép triển khai thi công (400 Bad Request)."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db, annex_status="DRAFT")
        admin_user = db.query(User).filter(User.username == "admin").first()

        payload = {
            "annex_id": annex.annex_id,
            "plot_id": plot.plot_id,
            "supervisor_id": admin_user.user_id,
            "start_date": str(date.today()),
            "expected_end_date": str(date.today() + timedelta(days=15)),
            "notes": "Lệnh thi công thử nghiệm phụ lục DRAFT",
        }

        resp = client.post(
            "/api/v1/construction/orders",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "chưa được kích hoạt" in resp.json()["detail"]
    finally:
        db.close()


def test_create_order_with_active_annex_and_default_tasks():
    """Tạo lệnh thi công từ phụ lục ACTIVE thành công, tự sinh 5 standard tasks và đổi plot -> UNDER_CONSTRUCTION."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db, annex_status="ACTIVE")
        admin_user = db.query(User).filter(User.username == "admin").first()

        payload = {
            "annex_id": annex.annex_id,
            "plot_id": plot.plot_id,
            "supervisor_id": admin_user.user_id,
            "start_date": str(date.today()),
            "expected_end_date": str(date.today() + timedelta(days=20)),
            "notes": "Thi công hoàn thiện phần mộ gia tộc",
        }

        resp = client.post(
            "/api/v1/construction/orders",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()

        assert data["annex_id"] == annex.annex_id
        assert data["plot_id"] == plot.plot_id
        assert data["status"] == "PENDING"
        assert Decimal(str(data["overall_progress"])) == Decimal("0.00")
        assert len(data["tasks"]) == 5
        assert data["total_tasks"] == 5
        assert data["required_tasks"] == 5

        # Verify plot status changed to UNDER_CONSTRUCTION
        db.refresh(plot)
        assert plot.status == "UNDER_CONSTRUCTION"

        # Verify standard task sort orders
        tasks = sorted(data["tasks"], key=lambda t: t["sort_order"])
        assert tasks[0]["sort_order"] == 1
        assert "Khảo sát" in tasks[0]["task_name"]
        assert tasks[4]["sort_order"] == 5
        assert "nghiệm thu" in tasks[4]["task_name"].lower()
    finally:
        db.close()


def test_staff_unavailability_and_conflict_warning():
    """G13: Đăng ký lịch bận/nghỉ phép và kiểm tra cảnh báo xung đột phân công."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        caretaker = db.query(User).filter(User.username == "caretaker").first()
        assert caretaker is not None

        start_d = date.today() + timedelta(days=5)
        end_d = date.today() + timedelta(days=10)

        # 1. Create unavailability
        resp = client.post(
            "/api/v1/construction/unavailability",
            json={
                "user_id": caretaker.user_id,
                "start_date": str(start_d),
                "end_date": str(end_d),
                "reason": "Nghỉ phép thường niên",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        unav_id = resp.json()["unavailability_id"]

        # 2. Check conflict in overlapping range
        check_resp = client.get(
            f"/api/v1/construction/staff-conflict-check?user_id={caretaker.user_id}&start_date={start_d}&end_date={end_d}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert check_resp.status_code == 200
        conflict_data = check_resp.json()
        assert conflict_data["has_conflict"] is True
        assert "Cảnh báo xung đột" in conflict_data["warning_message"]

        # 3. Check conflict in non-overlapping range
        future_start = date.today() + timedelta(days=20)
        future_end = date.today() + timedelta(days=25)
        check_no_conflict = client.get(
            f"/api/v1/construction/staff-conflict-check?user_id={caretaker.user_id}&start_date={future_start}&end_date={future_end}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert check_no_conflict.status_code == 200
        assert check_no_conflict.json()["has_conflict"] is False

        # 4. Clean up
        del_resp = client.delete(
            f"/api/v1/construction/unavailability/{unav_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 204
    finally:
        db.close()


def test_task_reorder_and_update():
    """G11: Sắp xếp lại thứ tự công việc checklist và cập nhật thông tin task."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db)
        admin_user = db.query(User).filter(User.username == "admin").first()

        order_resp = client.post(
            "/api/v1/construction/orders",
            json={
                "annex_id": annex.annex_id,
                "plot_id": plot.plot_id,
                "supervisor_id": admin_user.user_id,
                "expected_end_date": str(date.today() + timedelta(days=10)),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        order_id = order_resp.json()["order_id"]
        tasks = order_resp.json()["tasks"]
        t1, t2 = tasks[0], tasks[1]

        # Reorder: swap sort_order of t1 and t2
        reorder_resp = client.post(
            f"/api/v1/construction/orders/{order_id}/reorder-tasks",
            json={
                "orders": [
                    {"task_id": t1["task_id"], "sort_order": 2},
                    {"task_id": t2["task_id"], "sort_order": 1},
                ]
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert reorder_resp.status_code == 200
        reordered = {t["task_id"]: t["sort_order"] for t in reorder_resp.json()}
        assert reordered[t1["task_id"]] == 2
        assert reordered[t2["task_id"]] == 1

        # Update task field notes
        upd_resp = client.put(
            f"/api/v1/construction/tasks/{t1['task_id']}",
            json={"field_notes": "Đã khảo sát thực địa xong, đất cứng đạt chuẩn"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upd_resp.status_code == 200
        assert upd_resp.json()["field_notes"] == "Đã khảo sát thực địa xong, đất cứng đạt chuẩn"
    finally:
        db.close()


def test_task_evidence_ready_file_check():
    """Gate: Ảnh phải READY trước chốt; tệp đang upload hoặc sai không thể gán làm bằng chứng."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db)
        admin_user = db.query(User).filter(User.username == "admin").first()

        order_resp = client.post(
            "/api/v1/construction/orders",
            json={
                "annex_id": annex.annex_id,
                "plot_id": plot.plot_id,
                "supervisor_id": admin_user.user_id,
                "expected_end_date": str(date.today() + timedelta(days=10)),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        task_id = order_resp.json()["tasks"][0]["task_id"]

        # Create a file in STAGING status
        file_not_ready = FileObject(
            file_id=f"file_uploading_{uuid.uuid4().hex[:8]}",
            bucket_name="nghiatrang-private",
            object_key=f"uploads/{uuid.uuid4().hex}",
            file_name="dang_tai.jpg",
            mime_type="image/jpeg",
            file_size_bytes=1024,
            sha256_hash="0" * 64,
            state="STAGING",
            uploaded_by_user_id=admin_user.user_id,
        )
        db.add(file_not_ready)

        # Create a file in READY status
        file_ready = FileObject(
            file_id=f"file_ready_{uuid.uuid4().hex[:8]}",
            bucket_name="nghiatrang-private",
            object_key=f"uploads/{uuid.uuid4().hex}",
            file_name="da_xong.jpg",
            mime_type="image/jpeg",
            file_size_bytes=2048,
            sha256_hash="1" * 64,
            state="READY",
            uploaded_by_user_id=admin_user.user_id,
        )
        db.add(file_ready)
        db.commit()

        # 1. Attaching UPLOADING file must be rejected (Gate: ảnh phải READY)
        bad_resp = client.post(
            f"/api/v1/construction/tasks/{task_id}/evidences",
            json={"file_id": file_not_ready.file_id, "caption": "Ảnh móng"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert bad_resp.status_code == 400
        assert "chưa ở trạng thái READY" in bad_resp.json()["detail"]

        # 2. Attaching READY file succeeds
        ok_resp = client.post(
            f"/api/v1/construction/tasks/{task_id}/evidences",
            json={"file_id": file_ready.file_id, "caption": "Ảnh móng đã đổ bê tông"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert ok_resp.status_code == 201, ok_resp.text
        assert ok_resp.json()["file_id"] == file_ready.file_id
    finally:
        db.close()


def test_complete_task_required_without_evidence_rejected():
    """Gate: Thiếu ảnh READY trên task bắt buộc (is_required=True) bị từ chối hoàn tất."""
    db = SessionLocal()
    token = get_caretaker_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db)
        caretaker = db.query(User).filter(User.username == "caretaker").first()

        order_resp = client.post(
            "/api/v1/construction/orders",
            json={
                "annex_id": annex.annex_id,
                "plot_id": plot.plot_id,
                "supervisor_id": caretaker.user_id,
                "expected_end_date": str(date.today() + timedelta(days=10)),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        order_id = order_resp.json()["order_id"]
        task_id = order_resp.json()["tasks"][0]["task_id"]

        # Attempt to complete required task without evidence -> 400 Bad Request
        resp_no_ev = client.post(
            f"/api/v1/construction/tasks/{task_id}/complete",
            json={"field_notes": "Làm xong rồi nhưng chưa chụp ảnh"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_no_ev.status_code == 400
        assert "phải có ít nhất 1 ảnh" in resp_no_ev.json()["detail"]

        # Now complete with proof_media_url or attached evidence
        resp_with_proof = client.post(
            f"/api/v1/construction/tasks/{task_id}/complete",
            json={
                "field_notes": "Hoàn tất có ảnh",
                "proof_media_url": "https://storage.local/proof1.jpg",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_with_proof.status_code == 200, resp_with_proof.text
        assert resp_with_proof.json()["status"] == "DONE"

        # Verify order transitioned to IN_PROGRESS and progress updated
        order_get = client.get(
            f"/api/v1/construction/orders/{order_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert order_get.json()["status"] == "IN_PROGRESS"
        assert Decimal(str(order_get.json()["overall_progress"])) == Decimal("20.00")
    finally:
        db.close()


def test_progress_capped_and_complete_order_invariants():
    """Gate: Thiếu required task chặn 100%; hoàn tất lệnh thi công KHÔNG tự đổi an táng."""
    db = SessionLocal()
    token = get_admin_token()
    try:
        annex, plot, _ = create_test_active_contract_and_annex(db)
        admin_user = db.query(User).filter(User.username == "admin").first()

        # Create custom order with 2 tasks: 1 required, 1 optional
        order_resp = client.post(
            "/api/v1/construction/orders",
            json={
                "annex_id": annex.annex_id,
                "plot_id": plot.plot_id,
                "supervisor_id": admin_user.user_id,
                "expected_end_date": str(date.today() + timedelta(days=10)),
                "custom_tasks": [
                    {
                        "task_name": "Xây móng kim tĩnh (Bắt buộc)",
                        "is_required": True,
                        "sort_order": 1,
                    },
                    {
                        "task_name": "Trồng cỏ cảnh quan (Tùy chọn)",
                        "is_required": False,
                        "sort_order": 2,
                    },
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert order_resp.status_code == 201, order_resp.text
        order_id = order_resp.json()["order_id"]
        tasks = order_resp.json()["tasks"]
        t_req = next(t for t in tasks if t["is_required"])
        t_opt = next(t for t in tasks if not t["is_required"])

        # 1. Complete only the optional task
        client.post(
            f"/api/v1/construction/tasks/{t_opt['task_id']}/complete",
            json={"field_notes": "Trồng cỏ xong"},
            headers={"Authorization": f"Bearer {token}"},
        )

        # 2. Verify progress is 50%
        order_mid = client.get(
            f"/api/v1/construction/orders/{order_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert Decimal(str(order_mid.json()["overall_progress"])) == Decimal("50.00")

        # 3. Attempt to complete order while required task is pending -> 400 Bad Request
        bad_complete = client.post(
            f"/api/v1/construction/orders/{order_id}/complete",
            json={"notes": "Nghiệm thu sớm"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert bad_complete.status_code == 400
        assert "công việc bắt buộc chưa hoàn tất" in bad_complete.json()["detail"]

        # 4. Complete the required task with evidence
        client.post(
            f"/api/v1/construction/tasks/{t_req['task_id']}/complete",
            json={
                "field_notes": "Xây móng kim tĩnh hoàn thiện",
                "proof_media_url": "https://storage.local/kimtinh.jpg",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        # 5. Complete order now succeeds!
        complete_resp = client.post(
            f"/api/v1/construction/orders/{order_id}/complete",
            json={"notes": "Nghiệm thu toàn bộ công trình đạt chuẩn"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert complete_resp.status_code == 200, complete_resp.text
        comp_data = complete_resp.json()
        assert comp_data["status"] == "COMPLETED"
        assert Decimal(str(comp_data["overall_progress"])) == Decimal("100.00")
        assert comp_data["actual_end_date"] == str(date.today())

        # 6. CRITICAL DOMAIN INVARIANT CHECK:
        # "order hoàn thành không tự đổi trạng thái an táng"
        # Plot must NOT be OCCUPIED! Since no deceased was buried, it reverts to OWNED_EMPTY!
        db.refresh(plot)
        assert plot.status == "OWNED_EMPTY"
        slot = db.query(PlotSlot).filter(PlotSlot.plot_id == plot.plot_id).first()
        assert slot.status == "EMPTY"
        assert slot.current_deceased_id is None
    finally:
        db.close()
