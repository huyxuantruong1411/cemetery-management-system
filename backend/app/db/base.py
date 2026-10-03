# Import Base and all domain models to ensure Base.metadata is fully populated.
import app.modules.audit.models  # noqa: F401
import app.modules.auth.models  # noqa: F401
import app.modules.care.models  # noqa: F401
import app.modules.catalog.models  # noqa: F401
import app.modules.construction.models  # noqa: F401
import app.modules.contracts.models  # noqa: F401
import app.modules.documents.models  # noqa: F401
import app.modules.finance.models  # noqa: F401
import app.modules.jobs.models  # noqa: F401
import app.modules.plots.models  # noqa: F401
import app.modules.profiles.models  # noqa: F401
from app.db.session import Base  # noqa: F401
