import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, ".")

from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    items = conn.execute(text("SELECT item_id, schedule_id, task_description FROM care_checklist_items WHERE schedule_id = 146")).fetchall()
    print("Schedule 146 items:", items)

    all_corrupt = conn.execute(text("SELECT item_id, schedule_id, task_description FROM care_checklist_items WHERE CHARINDEX('?', task_description) > 0")).fetchall()
    print("Total items with ?:", len(all_corrupt))
    for it in all_corrupt[:10]:
        print("  corrupt:", it)
