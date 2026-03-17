"""SQL repair layer — catches common Postgres errors and auto-fixes generated SQL.

Handles:
- GROUP BY missing columns (column X must appear in GROUP BY or aggregate)
- Type mismatches in JOIN/WHERE (operator does not exist: text = date)
"""

import re
import logging

logger = logging.getLogger(__name__)

# Only allow safe column identifiers: lowercase letters, digits, dots, underscores
SAFE_IDENTIFIER = re.compile(r'^[a-z][a-z0-9_.]*$')


def repair_group_by(sql: str, error_msg: str) -> str | None:
    """Fix 'column X must appear in the GROUP BY clause' errors.

    Extracts the missing column from the error message, finds the GROUP BY
    clause, and appends the missing column.
    """
    match = re.search(
        r'column "?([a-z_.]+)"? must appear in the GROUP BY clause',
        error_msg,
        re.IGNORECASE,
    )
    if not match:
        return None

    missing_col = match.group(1)

    # Reject anything that doesn't look like a safe column identifier
    if not SAFE_IDENTIFIER.match(missing_col):
        logger.warning("SQL repair (GROUP BY): rejected unsafe column name '%s'", missing_col)
        return None

    group_by_match = re.search(r'(GROUP\s+BY\s+)(.*?)(?=\s+(?:ORDER|HAVING|LIMIT|OFFSET|$|\)))',
                                sql, re.IGNORECASE | re.DOTALL)
    if not group_by_match:
        return None

    group_by_start = group_by_match.start()
    group_by_end = group_by_match.end()
    existing_group_by = group_by_match.group(0)

    repaired = sql[:group_by_end] + ", " + missing_col + sql[group_by_end:]
    logger.info("SQL repair (GROUP BY): added '%s' to GROUP BY clause", missing_col)
    return repaired


def repair_type_mismatch(sql: str, error_msg: str) -> str | None:
    """Fix 'operator does not exist: text = date' type mismatch errors.

    When a text column is compared to a date column, adds ::text cast
    to the date side or ::date cast to the text side.
    """
    # Match: operator does not exist: text = date (or date = text)
    match = re.search(
        r'operator does not exist:\s+(text)\s*=\s*(date)|operator does not exist:\s+(date)\s*=\s*(text)',
        error_msg,
        re.IGNORECASE,
    )
    if not match:
        return None

    # Find the problematic line from the error hint
    line_match = re.search(r'LINE\s+\d+:\s*(.+)', error_msg)
    if not line_match:
        # Fallback: cast all dim_date joins
        repaired = re.sub(
            r'(\w+\.service_date)\s*=\s*(\w+\.date_key)',
            r'\1::date = \2',
            sql,
        )
        if repaired != sql:
            logger.info("SQL repair (TYPE CAST): added ::date cast to service_date = date_key join")
            return repaired
        return None

    problem_fragment = line_match.group(1).strip()

    # Try to find and fix the specific comparison
    # Pattern: text_col = date_col -> text_col::date = date_col
    repaired = re.sub(
        r'(\w+\.(?:service_date|payment_date|invoice_date|start_date|end_date))\s*=\s*(\w+\.date_key)',
        r'\1::date = \2',
        sql,
    )
    if repaired != sql:
        logger.info("SQL repair (TYPE CAST): added ::date cast for text-to-date comparison")
        return repaired

    # Reverse: date_col = text_col -> date_col = text_col::date
    repaired = re.sub(
        r'(\w+\.date_key)\s*=\s*(\w+\.(?:service_date|payment_date|invoice_date|start_date|end_date))',
        r'\1 = \2::date',
        sql,
    )
    if repaired != sql:
        logger.info("SQL repair (TYPE CAST): added ::date cast for date-to-text comparison")
        return repaired

    return None


def attempt_repair(sql: str, error_msg: str) -> str | None:
    """Try all repair strategies. Returns repaired SQL or None if unfixable."""
    error_str = str(error_msg)

    repairs = [
        repair_group_by,
        repair_type_mismatch,
    ]

    for repair_fn in repairs:
        result = repair_fn(sql, error_str)
        if result is not None:
            return result

    return None
