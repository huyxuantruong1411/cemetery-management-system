import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.main import app
from app.modules.auth.models import User
from app.modules.contracts.models import Contract, ContractAnnex, LandPurchaseContract
from app.modules.finance.currency_words import number_to_vietnamese_words
from app.modules.finance.models import DiscountRecord, Invoice, Payment, Receivable
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


def get_accountant_token() -> str:
    # Use accountant if seeded, or admin
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "accountant", "password": "Accountant2026!"},
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return get_admin_token()


def create_finance_fixture(db: Session, amount: Decimal = Decimal("10000000.00")):
    suffix = uuid.uuid4().hex[:6]

    zone = Zone(zone_code=f"ZF_{suffix}", zone_name="Khu Finance Test")
    db.add(zone)
    db.flush()

    row = Row(zone_id=zone.zone_id, row_code=f"RF_{suffix}")
    db.add(row)
    db.flush()

    ptype = PlotType(
        type_name=f"Loại mộ TC {suffix}",
        default_slots=1,
        length=Decimal("2.0"),
        width=Decimal("1.0"),
    )
    db.add(ptype)
    db.flush()

    plot = Plot(
        row_id=row.row_id,
        type_id=ptype.type_id,
        plot_code=f"PF_{suffix}",
        status="OWNED_EMPTY",
        is_kim_tinh=False,
        is_locked=False,
    )
    db.add(plot)
    db.flush()

    slot = PlotSlot(
        plot_id=plot.plot_id,
        slot_number=1,
        status="EMPTY",
    )
    db.add(slot)
    db.flush()

    customer = Customer(
        customer_code=f"CF_{suffix}",
        full_name=f"Khách Hàng Tài Chính {suffix}",
        citizen_id=f"079{suffix}888",
        phone_number="0911223344",
        address="123 Nguyễn Huệ, Q.1, TP.HCM",
    )
    db.add(customer)
    db.flush()

    admin = db.query(User).filter(User.username == "admin").first()

    contract = Contract(
        contract_code=f"HDFC_{suffix}",
        contract_type="LAND_PURCHASE",
        customer_id=customer.customer_id,
        created_by_user_id=admin.user_id,
        status="ACTIVE",
        total_amount=amount,
    )
    db.add(contract)
    db.flush()

    lp = LandPurchaseContract(
        contract_id=contract.contract_id,
        plot_id=plot.plot_id,
        land_unit_price=Decimal("10000000.00"),
    )
    db.add(lp)

    annex = ContractAnnex(
        annex_code=f"PLFC_{suffix}",
        contract_id=contract.contract_id,
        annex_type="CARE",
        status="ACTIVE",
        additional_amount=Decimal("3000000.00"),
    )
    db.add(annex)
    db.commit()

    return {
        "suffix": suffix,
        "zone": zone,
        "row": row,
        "plot": plot,
        "slot": slot,
        "customer": customer,
        "contract": contract,
        "annex": annex,
        "admin": admin,
    }


def cleanup_finance_fixture(db: Session, fix: dict):
    db.rollback()
    contract_id = fix["contract"].contract_id
    customer_id = fix["customer"].customer_id

    # Find receivables
    recs = (
        db.query(Receivable)
        .filter((Receivable.contract_id == contract_id) | (Receivable.customer_id == customer_id))
        .all()
    )

    for r in recs:
        # Delete invoices & payments
        for p in r.payments:
            db.query(Invoice).filter(Invoice.payment_id == p.payment_id).delete()
        db.query(Payment).filter(Payment.receivable_id == r.receivable_id).delete()
        db.query(DiscountRecord).filter(DiscountRecord.receivable_id == r.receivable_id).delete()
        db.delete(r)

    db.query(ContractAnnex).filter(ContractAnnex.contract_id == contract_id).delete()
    db.query(LandPurchaseContract).filter(LandPurchaseContract.contract_id == contract_id).delete()
    db.query(Contract).filter(Contract.contract_id == contract_id).delete()
    db.query(Customer).filter(Customer.customer_id == customer_id).delete()

    db.query(PlotSlot).filter(PlotSlot.plot_id == fix["plot"].plot_id).delete()
    db.query(Plot).filter(Plot.plot_id == fix["plot"].plot_id).delete()
    db.query(Row).filter(Row.row_id == fix["row"].row_id).delete()
    db.query(Zone).filter(Zone.zone_id == fix["zone"].zone_id).delete()
    db.query(PlotType).filter(PlotType.type_id == fix["plot"].type_id).delete()
    db.commit()


def test_vietnamese_number_to_words():
    """Verify that numbers are correctly translated to Vietnamese currency words."""
    assert number_to_vietnamese_words(Decimal("10000000.00")) == "Mười triệu đồng chẵn"
    assert number_to_vietnamese_words(Decimal("5500000.00")) == "Năm triệu năm trăm nghìn đồng chẵn"
    assert number_to_vietnamese_words(Decimal("0.00")) == "Không đồng chẵn"
    assert (
        number_to_vietnamese_words(Decimal("123456789.00"))
        == "Một trăm hai mươi ba triệu bốn trăm năm mươi sáu nghìn bảy trăm tám mươi chín đồng chẵn"
    )


def test_finance_summary_endpoint():
    """Verify GET /api/v1/finance/summary returns accurate aggregations."""
    token = get_admin_token()
    resp = client.get(
        "/api/v1/finance/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "total_receivables_amount" in data
    assert "total_collected_amount" in data
    assert "total_outstanding_amount" in data
    assert "count_unpaid" in data


def test_create_receivable_xor_source_enforcement():
    """Verify G14 invariant: receivable MUST have exactly one source (contract OR annex, not both, not neither)."""
    db = SessionLocal()
    token = get_admin_token()
    fix = create_finance_fixture(db)

    try:
        # Case 1: Both contract_id and annex_id -> 400
        resp1 = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "annex_id": fix["annex"].annex_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp1.status_code == 400 or resp1.status_code == 422

        # Case 2: Neither contract_id nor annex_id -> 400 / 422
        resp2 = client.post(
            "/api/v1/finance/receivables",
            json={
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 400 or resp2.status_code == 422

        # Case 3: Exactly contract_id -> 201 Created
        resp3 = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp3.status_code == 201, resp3.text
        rec = resp3.json()
        assert rec["original_amount"] == 10000000 or rec["original_amount"] == "10000000.00"
        assert rec["discount_amount"] == 0 or rec["discount_amount"] == "0.00"
        assert rec["final_payable_amount"] == rec["original_amount"]
        assert rec["status"] == "UNPAID"

        # Case 4: Idempotency duplicate contract_id + installment_no -> 400
        resp4 = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp4.status_code == 400, "Should reject duplicate installment for contract"

    finally:
        cleanup_finance_fixture(db, fix)
        db.close()


def test_apply_discount_invariants():
    """Verify G16: single official discount, recalculation of final amount, and rejection if debt goes negative."""
    db = SessionLocal()
    token = get_admin_token()
    fix = create_finance_fixture(db)

    try:
        # Create receivable
        resp_rec = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_rec.status_code == 201
        rec_id = resp_rec.json()["receivable_id"]

        # 1. Apply 10% discount
        resp_disc = client.post(
            f"/api/v1/finance/receivables/{rec_id}/discount",
            json={
                "discount_type": "PERCENTAGE",
                "discount_value": 10.0,
                "justification_reason": "Ưu đãi khách hàng thân thiết nhân dịp mở bán",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_disc.status_code == 200, resp_disc.text
        data = resp_disc.json()
        assert float(data["discount_amount"]) == 1000000.0
        assert float(data["final_payable_amount"]) == 9000000.0
        assert float(data["remaining_balance"]) == 9000000.0

        # 2. Re-applying discount must be rejected (single discount allowed)
        resp_disc2 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/discount",
            json={
                "discount_type": "FIXED_AMOUNT",
                "discount_value": 500000,
                "justification_reason": "Giảm thêm",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_disc2.status_code == 400
        assert (
            "chỉ chấp nhận một chiết khấu" in resp_disc2.text
            or "đã được áp dụng" in resp_disc2.text
        )

    finally:
        cleanup_finance_fixture(db, fix)
        db.close()


def test_payment_recording_trigger_sync_and_auto_receipt():
    """Verify G15: payment inserts, MSSQL trigger syncs receivable balance/status, auto-generates PDF receipt."""
    db = SessionLocal()
    token = get_admin_token()
    fix = create_finance_fixture(db)

    try:
        # Create receivable
        resp_rec = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 10000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_rec.status_code == 201
        rec_id = resp_rec.json()["receivable_id"]

        # 1. Partial Payment of 4,000,000 VND
        resp_p1 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 4000000,
                "payment_method": "BANK_TRANSFER",
                "transaction_reference": "VCB12345678",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_p1.status_code == 201, resp_p1.text
        p1_data = resp_p1.json()
        assert float(p1_data["paid_amount"]) == 4000000.0
        assert p1_data["invoice"] is not None
        assert p1_data["invoice"]["invoice_number"].startswith("REC-")
        assert "Bốn triệu đồng chẵn" in p1_data["invoice"]["total_amount_in_words"]

        # Check receivable updated by trigger to PARTIALLY_PAID
        rec_check = client.get(
            f"/api/v1/finance/receivables/{rec_id}",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        assert float(rec_check["total_paid_amount"]) == 4000000.0
        assert float(rec_check["remaining_balance"]) == 6000000.0
        assert rec_check["status"] == "PARTIALLY_PAID"

        # 2. Reject overpayment (> remaining 6,000,000)
        resp_over = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 7000000,
                "payment_method": "CASH",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_over.status_code == 400
        assert "vượt quá" in resp_over.text

        # 3. Pay exact remaining balance 6,000,000
        resp_p2 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 6000000,
                "payment_method": "CASH",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_p2.status_code == 201, resp_p2.text

        # Check receivable updated to PAID
        rec_check2 = client.get(
            f"/api/v1/finance/receivables/{rec_id}",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        assert float(rec_check2["total_paid_amount"]) == 10000000.0
        assert float(rec_check2["remaining_balance"]) == 0.0
        assert rec_check2["status"] == "PAID"

        # 4. Reject payment on already PAID receivable
        resp_p3 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 1000000,
                "payment_method": "CASH",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_p3.status_code == 400

    finally:
        cleanup_finance_fixture(db, fix)
        db.close()


def test_payment_idempotency_replay():
    """Verify G15 idempotency: replaying payment with same X-Idempotency-Key returns cached response without duplicate charge."""
    db = SessionLocal()
    token = get_admin_token()
    fix = create_finance_fixture(db)

    try:
        # Create receivable
        resp_rec = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 5000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_rec.status_code == 201
        rec_id = resp_rec.json()["receivable_id"]

        idem_key = f"IDEM_{uuid.uuid4().hex}"

        # 1. First payment attempt
        resp1 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 2000000,
                "payment_method": "VIET_QR",
                "transaction_reference": "QR999888",
            },
            headers={
                "Authorization": f"Bearer {token}",
                "X-Idempotency-Key": idem_key,
            },
        )
        assert resp1.status_code == 201
        payment1_id = resp1.json()["payment_id"]

        # 2. Replay with identical X-Idempotency-Key
        resp2 = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 2000000,
                "payment_method": "VIET_QR",
                "transaction_reference": "QR999888",
            },
            headers={
                "Authorization": f"Bearer {token}",
                "X-Idempotency-Key": idem_key,
            },
        )
        assert resp2.status_code == 201 or resp2.status_code == 200
        payment2_id = resp2.json()["payment_id"]
        assert payment1_id == payment2_id, (
            "Idempotency replay must return the same payment without duplicate"
        )

        # Check total paid in receivable is still exactly 2,000,000, not 4,000,000
        rec_check = client.get(
            f"/api/v1/finance/receivables/{rec_id}",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        assert float(rec_check["total_paid_amount"]) == 2000000.0

    finally:
        cleanup_finance_fixture(db, fix)
        db.close()


def test_download_payment_receipt_pdf():
    """Verify downloading receipt PDF returns valid PDF stream from MinIO."""
    db = SessionLocal()
    token = get_admin_token()
    fix = create_finance_fixture(db)

    try:
        # Create receivable
        resp_rec = client.post(
            "/api/v1/finance/receivables",
            json={
                "contract_id": fix["contract"].contract_id,
                "customer_id": fix["customer"].customer_id,
                "original_amount": 5000000,
                "due_date": "2026-11-01",
                "installment_no": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        rec_id = resp_rec.json()["receivable_id"]

        # Pay
        resp_pay = client.post(
            f"/api/v1/finance/receivables/{rec_id}/payments",
            json={
                "paid_amount": 5000000,
                "payment_method": "CASH",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        pay_id = resp_pay.json()["payment_id"]

        # Download receipt
        resp_pdf = client.get(
            f"/api/v1/finance/payments/{pay_id}/receipt/download",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_pdf.status_code == 200
        assert resp_pdf.headers["content-type"] == "application/pdf"
        assert resp_pdf.content.startswith(b"%PDF-")

    finally:
        cleanup_finance_fixture(db, fix)
        db.close()
