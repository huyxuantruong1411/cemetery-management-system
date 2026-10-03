import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.contracts.models import Contract
from app.modules.finance.models import Payment, Receivable
from app.modules.plots.models import Plot, PlotType, Row, Zone
from app.modules.profiles.models import Customer


def test_insert_plot_with_trigger():
    """Verify that inserting Plot does not fail due to OUTPUT INSERTED on MSSQL with trigger."""
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:6]

    try:
        # 1. Setup Zone, Row, PlotType
        zone = Zone(
            zone_code=f"Z_{unique_suffix}",
            zone_name="Khu Test",
            total_rows=1,
            description="Khu mô hình thử nghiệm",
        )
        db.add(zone)
        db.flush()

        row = Row(
            zone_id=zone.zone_id,
            row_code=f"R_{unique_suffix}",
            total_plots=1,
        )
        db.add(row)
        db.flush()

        plot_type = PlotType(
            type_name=f"Loại mộ {unique_suffix}",
            default_slots=1,
            length=Decimal("2.50"),
            width=Decimal("1.20"),
            description="Mộ thử nghiệm",
        )
        db.add(plot_type)
        db.flush()

        # 2. Insert Plot (which has trigger trg_plots_enforce_kim_tinh_immutability)
        plot = Plot(
            row_id=row.row_id,
            type_id=plot_type.type_id,
            plot_code=f"P_{unique_suffix}",
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(plot)
        db.commit()

        # 3. Verify plot was saved and has ID without trigger error
        assert plot.plot_id is not None
        assert plot.plot_code == f"P_{unique_suffix}"

    finally:
        # Cleanup
        db.rollback()
        db.query(Plot).filter(Plot.plot_code == f"P_{unique_suffix}").delete()
        db.query(Row).filter(Row.row_code == f"R_{unique_suffix}").delete()
        db.query(Zone).filter(Zone.zone_code == f"Z_{unique_suffix}").delete()
        db.query(PlotType).filter(PlotType.type_name == f"Loại mộ {unique_suffix}").delete()
        db.commit()
        db.close()


def test_insert_payment_with_trigger():
    """Verify that inserting Payment triggers balance sync on Receivable without OUTPUT INSERTED error."""
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:6]

    user = None
    customer = None
    contract = None
    receivable = None

    try:
        # 1. Setup User, Customer & Contract
        user = User(
            username=f"user_{unique_suffix}",
            password_hash="fakehash",
            full_name="Nhân viên Test",
            email=f"user_{unique_suffix}@example.com",
            is_active=True,
            auth_version=1,
        )
        db.add(user)
        db.flush()

        customer = Customer(
            customer_code=f"C_{unique_suffix}",
            full_name="Nguyễn Văn Test",
            citizen_id=f"079{unique_suffix}999",
            phone_number="0901234567",
            address="TP. Hồ Chí Minh",
        )
        db.add(customer)
        db.flush()

        contract = Contract(
            contract_code=f"HD_{unique_suffix}",
            contract_type="LAND_PURCHASE",
            customer_id=customer.customer_id,
            created_by_user_id=user.user_id,
            status="ACTIVE",
            total_amount=Decimal("10000000.00"),
        )
        db.add(contract)
        db.flush()

        # 2. Setup Receivable
        receivable = Receivable(
            contract_id=contract.contract_id,
            customer_id=customer.customer_id,
            original_amount=Decimal("10000000.00"),
            discount_amount=Decimal("0.00"),
            final_payable_amount=Decimal("10000000.00"),
            total_paid_amount=Decimal("0.00"),
            status="UNPAID",
            due_date=date.today(),
            created_at=datetime.now(timezone.utc),
        )
        db.add(receivable)
        db.commit()
        db.refresh(receivable)
        assert receivable.receivable_id is not None

        # 3. Insert Payment (has trigger trg_payments_sync_receivable_balance)
        payment = Payment(
            receivable_id=receivable.receivable_id,
            paid_amount=Decimal("5000000.00"),
            payment_method="BANK_TRANSFER",
            transaction_reference="REF12345",
            recorded_by_user_id=user.user_id,
            paid_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        db.commit()

        # 4. Refresh receivable to observe trigger effect
        db.refresh(receivable)
        assert receivable.total_paid_amount == Decimal("5000000.00")
        assert receivable.status == "PARTIALLY_PAID"

    finally:
        # Cleanup
        db.rollback()
        if receivable and receivable.receivable_id:
            db.query(Payment).filter(Payment.receivable_id == receivable.receivable_id).delete()
            db.query(Receivable).filter(
                Receivable.receivable_id == receivable.receivable_id
            ).delete()
        if contract and contract.contract_id:
            db.query(Contract).filter(Contract.contract_id == contract.contract_id).delete()
        if customer and customer.customer_id:
            db.query(Customer).filter(Customer.customer_id == customer.customer_id).delete()
        if user and user.user_id:
            db.query(User).filter(User.user_id == user.user_id).delete()
        db.commit()
        db.close()
