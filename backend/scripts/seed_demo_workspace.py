"""Add labelled staff and GIS fixtures without resetting existing business data.

Dry run: uv run python scripts/seed_demo_workspace.py
Apply:   uv run python scripts/seed_demo_workspace.py --apply
Credentials and a before/after manifest are stored only in ignored runtime on D:.
"""

import argparse
import csv
import json
import math
import re
import secrets
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.base  # noqa: E402,F401
from app.core.security import get_password_hash  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.modules.auth.models import AuthSession, Permission, Role, User  # noqa: E402
from app.modules.care.models import CareSchedule  # noqa: E402
from app.modules.construction.models import StaffUnavailability  # noqa: E402
from app.modules.plots.models import Plot, PlotSlot, PlotType, Row, Zone  # noqa: E402
from scripts.seed_rbac import PERMISSIONS, ROLE_CONFIGS  # noqa: E402

TAG = "[SYNTHETIC_GIS:20261017]"
ZONE_CODES = ("KHU-A", "KHU-B", "KHU-VIP")
# These prefixes come from checked-in test fixtures, not inferred customer names.
FIXTURE_CODE = re.compile(r"^(BIZ1-|KT-|STD-|EX-|TR-|PC_|PF_|PP_|P_|TEST-P-|M07-)")
OUT = Path(__file__).resolve().parents[1] / "runtime/demo_workspace_20261017"


def backup(database: str) -> str:
    destination = OUT / f"{database}_before_{datetime.now(timezone.utc):%Y%m%dT%H%M%S}.bak"
    assert destination.drive.upper() == "D:" and not destination.exists()
    raw = engine.raw_connection()
    try:
        raw.driver_connection.autocommit = True
        cur = raw.cursor()
        cur.execute("SELECT DB_NAME()")
        assert cur.fetchone()[0] == database
        for sql in (
            f"BACKUP DATABASE [{database}] TO DISK=N'{destination}' WITH COPY_ONLY,CHECKSUM",
            f"RESTORE VERIFYONLY FROM DISK=N'{destination}' WITH CHECKSUM",
        ):
            cur.execute(sql)
            while cur.nextset():
                pass
        cur.close()
    finally:
        raw.close()
    return str(destination)


def synchronize_roles(db):
    """Reconcile only the three operational roles; preserve Admin and all passwords."""
    permissions = {p.permission_code: p for p in db.query(Permission).all()}
    for resource, action, code in PERMISSIONS:
        if code not in permissions:
            permissions[code] = Permission(resource=resource, action=action, permission_code=code)
            db.add(permissions[code])
    changed = []
    for name in ("MARKETING", "ACCOUNTANT", "CARETAKER"):
        role = db.query(Role).filter_by(role_name=name).one()
        desired = set(ROLE_CONFIGS[name]["permissions"])
        if {p.permission_code for p in role.permissions} != desired:
            role.permissions = [permissions[code] for code in sorted(desired)]
            for user in role.users:
                if any(r.role_name == "ADMIN" for r in user.roles):
                    continue
                user.auth_version += 1
                for session in db.query(AuthSession).filter_by(user_id=user.user_id):
                    session.is_revoked = True
            changed.append(name)
    return changed


def populate(db):
    manifest = {
        "created_users": [],
        "created_rows": [],
        "created_plots": [],
        "coordinates": [],
        "availability": [],
    }
    manifest["updated_roles"] = synchronize_roles(db)
    roles = {r.role_name: r for r in db.query(Role).all()}
    credentials = []
    for prefix, title, role, count in (
        ("marketing", "Tiếp thị mô phỏng", "MARKETING", 2),
        ("ketoan", "Kế toán mô phỏng", "ACCOUNTANT", 2),
        ("quantrang", "Quản trang mô phỏng", "CARETAKER", 8),
    ):
        for i in range(1, count + 1):
            username = f"demo.{prefix}{i:02}"
            if db.query(User).filter_by(username=username).first():
                continue
            password = secrets.token_urlsafe(15)
            user = User(
                username=username,
                full_name=f"{title} {i:02}",
                email=f"{username}@example.invalid",
                password_hash=get_password_hash(password),
                roles=[roles[role]],
            )
            db.add(user)
            manifest["created_users"].append(username)
            credentials.append({"username": username, "password": password, "role": role})
    db.flush()
    types = db.query(PlotType).order_by(PlotType.type_id).all()
    by_name = {p.type_name: p for p in types}
    doi_name = "Mộ Đôi Tiêu Chuẩn" if "Mộ Đôi Tiêu Chuẩn" in by_name else "Mộ Đôi Kim Tĩnh"
    selected_types = [
        by_name[name] for name in ("Mộ Đơn Tiêu Chuẩn", doi_name, "Khuôn Viên Gia Tộc")
    ]
    for z_index, code in enumerate(ZONE_CODES):
        zone = db.query(Zone).filter_by(zone_code=code).one()
        rows = db.query(Row).filter_by(zone_id=zone.zone_id).order_by(Row.row_id).all()
        for index in range(len(rows), 8):
            row = Row(zone_id=zone.zone_id, row_code=f"DEMO-H{index + 1:02}", total_plots=0)
            db.add(row)
            db.flush()
            rows.append(row)
            manifest["created_rows"].append(row.row_id)
        for row_index, row in enumerate(rows[:8]):
            plot_type = selected_types[z_index]
            for col in range(1, 17):
                plot_code = f"DEMO-{code[4:]}-H{row_index + 1:02}-{col:02}"
                if db.query(Plot).filter_by(plot_code=plot_code).first():
                    continue
                plot = Plot(
                    plot_code=plot_code,
                    row_id=row.row_id,
                    type_id=plot_type.type_id,
                    status="EMPTY_UNSOLD",
                    is_kim_tinh=False,
                    is_locked=False,
                    notes=f"{TAG} Ô mộ mô phỏng để thực hành; không phải vị trí khảo sát.",
                )
                db.add(plot)
                db.flush()
                for number in range(1, plot_type.default_slots + 1):
                    db.add(PlotSlot(plot_id=plot.plot_id, slot_number=number, status="EMPTY"))
                manifest["created_plots"].append(plot.plot_id)
            row.total_plots = db.query(Plot).filter_by(row_id=row.row_id).count()
        zone.total_rows = db.query(Row).filter_by(zone_id=zone.zone_id).count()

    # Only labelled new fixtures or identifiable legacy test fixtures; never touch locked plots.
    zones = db.query(Zone).order_by(Zone.zone_id).all()
    zones.sort(
        key=lambda z: (
            z.zone_code not in ZONE_CODES,
            ZONE_CODES.index(z.zone_code) if z.zone_code in ZONE_CODES else z.zone_id,
        )
    )
    band_north = 0.0
    for start in range(0, len(zones), 3):
        band_height = 0.0
        for column, zone in enumerate(zones[start : start + 3]):
            north = band_north
            for row in sorted(zone.rows, key=lambda r: r.row_id):
                plots = sorted(row.plots, key=lambda p: p.plot_code)
                for index, plot in enumerate(plots):
                    if plot.is_locked or not (
                        TAG in (plot.notes or "") or FIXTURE_CODE.match(plot.plot_code)
                    ):
                        continue
                    # Reserve enough room even for family plots and leave aisles every 16 columns.
                    east = column * 180 + (index % 16) * 9
                    y = north + (index // 16) * 12
                    lat = Decimal(str(10.9252 + y / 111320)).quantize(Decimal(".0000001"))
                    lng = Decimal(
                        str(106.8252 + east / (111320 * math.cos(math.radians(10.9252))))
                    ).quantize(Decimal(".0000001"))
                    if plot.latitude == lat and plot.longitude == lng and TAG in (plot.notes or ""):
                        continue
                    manifest["coordinates"].append(
                        {
                            "plot_id": plot.plot_id,
                            "plot_code": plot.plot_code,
                            "before_lat": str(plot.latitude) if plot.latitude is not None else None,
                            "before_lng": str(plot.longitude)
                            if plot.longitude is not None
                            else None,
                            "before_notes": plot.notes,
                            "latitude": str(lat),
                            "longitude": str(lng),
                        }
                    )
                    plot.latitude = lat
                    plot.longitude = lng
                    if TAG not in (plot.notes or ""):
                        plot.notes = f"{TAG} Vị trí mô phỏng, chưa khảo sát.\n{plot.notes or ''}"
                north += max(1, math.ceil(len(plots) / 16)) * 12 + 8
            band_height = max(band_height, north - band_north)
        band_north += max(40, band_height) + 30

    scheduled = (
        db.query(CareSchedule.scheduled_date)
        .filter(CareSchedule.status != "CLOSED", CareSchedule.scheduled_date >= date(2026, 10, 17))
        .distinct()
        .order_by(CareSchedule.scheduled_date)
        .limit(2)
        .all()
    )
    dates = [row[0] for row in scheduled] or [date(2026, 10, 19), date(2026, 10, 20)]
    for number, day in enumerate(dates, 1):
        user = db.query(User).filter_by(username=f"demo.quantrang{number:02}").one()
        reason = "DEMO-20261017: Lịch bận mô phỏng để thực hành phân công"
        if (
            not db.query(StaffUnavailability)
            .filter_by(user_id=user.user_id, start_date=day, reason=reason)
            .first()
        ):
            db.add(
                StaffUnavailability(
                    user_id=user.user_id, start_date=day, end_date=day, reason=reason
                )
            )
            manifest["availability"].append({"username": user.username, "date": str(day)})
    return manifest, credentials


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with engine.connect() as connection:
        database = connection.exec_driver_sql("SELECT DB_NAME()").scalar()
    if database not in ("QL_NghiaTrang", "QL_NghiaTrang_Test"):
        raise RuntimeError("Unexpected database; no changes applied")
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.apply:
        print(
            json.dumps(
                {
                    "database": database,
                    "plan": "12 non-admin demo accounts; 384 plots in KHU-A/B/VIP; coordinates only for unlocked identified synthetic fixtures; two sample staff absences; reconcile operational roles",
                    "apply": False,
                }
            )
        )
        return
    backup_path = backup(database)
    with SessionLocal() as db:
        try:
            manifest, credentials = populate(db)
            manifest["database"] = database
            manifest["backup"] = backup_path
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
            # Keep recovery data and newly generated passwords before the single commit.
            (OUT / f"manifest-{database}-{stamp}.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8"
            )
            if credentials:
                with (OUT / f"accounts-{database}-{stamp}.csv").open(
                    "w", encoding="utf-8-sig", newline=""
                ) as stream:
                    writer = csv.DictWriter(stream, fieldnames=["username", "password", "role"])
                    writer.writeheader()
                    writer.writerows(credentials)
            db.commit()
        except Exception:
            db.rollback()
            raise
    print(
        json.dumps(
            {
                "database": database,
                "created_users": len(manifest["created_users"]),
                "created_rows": len(manifest["created_rows"]),
                "created_plots": len(manifest["created_plots"]),
                "located_fixtures": len(manifest["coordinates"]),
                "output_directory": str(OUT),
            }
        )
    )


if __name__ == "__main__":
    main()
