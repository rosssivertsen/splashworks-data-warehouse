"""ETL configuration — database connections, file paths, company mappings."""

import os
from pathlib import Path

# Company ID to friendly name mapping
# Keys are extract file stems as Skimmer names them (AQPS/JOMO: lowercase hex;
# newer companies: uppercase UUID with dashes).
COMPANY_MAP = {
    "e265c9dee47c47c6a73f689b0df467ca": "AQPS",
    "95d37a64d1794a1caef111e801db5477": "JOMO",
    "18E63E2C-371C-46B9-BF68-8BBDFDC1008D": "CLERMONT",  # "Splashworks - Clermont" (onboarded 2026-07-04)
}

# Reverse mapping
COMPANY_IDS = {v: k for k, v in COMPANY_MAP.items()}

# File paths
EXTRACT_DIR = Path(os.environ.get("EXTRACT_DIR", "/data/extracts"))

# Database connection
DATABASE_URL = os.environ["DATABASE_URL"]

# Raw schema prefix
RAW_SCHEMA = "raw_skimmer"
