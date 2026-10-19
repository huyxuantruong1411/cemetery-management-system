import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')
from app.db.session import SessionLocal
from app.modules.plots.models import Plot, PlotSlot, PlotType

def sync_missing_slots():
    db = SessionLocal()
    try:
        plots_without_slots = (
            db.query(Plot)
            .outerjoin(PlotSlot, Plot.plot_id == PlotSlot.plot_id)
            .filter(PlotSlot.slot_id.is_(None))
            .all()
        )
        print(f"Found {len(plots_without_slots)} plots without slots.")
        
        created_count = 0
        for p in plots_without_slots:
            pt = db.query(PlotType).filter(PlotType.type_id == p.type_id).first()
            num_slots = pt.default_slots if pt and pt.default_slots else 1
            for i in range(1, num_slots + 1):
                slot_status = "OCCUPIED" if p.status == "OCCUPIED" else "EMPTY"
                slot = PlotSlot(
                    plot_id=p.plot_id,
                    slot_number=i,
                    status=slot_status,
                )
                db.add(slot)
                created_count += 1
        
        db.commit()
        print(f"Successfully generated {created_count} slots for {len(plots_without_slots)} plots.")
    finally:
        db.close()

if __name__ == "__main__":
    sync_missing_slots()
