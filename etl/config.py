"""ETL configuration — database connections, file paths, company mappings."""

import os
from pathlib import Path

# Company ID to friendly name mapping
COMPANY_MAP = {
    "e265c9dee47c47c6a73f689b0df467ca": "AQPS",
    "95d37a64d1794a1caef111e801db5477": "JOMO",
}

# Reverse mapping
COMPANY_IDS = {v: k for k, v in COMPANY_MAP.items()}

# File paths
EXTRACT_DIR = Path(os.environ.get("EXTRACT_DIR", "/data/extracts"))

# Database connection
DATABASE_URL = os.environ["DATABASE_URL"]

# Raw schema prefix
RAW_SCHEMA = "raw_skimmer"
