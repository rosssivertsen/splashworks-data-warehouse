"""Tests for the SQL repair layer."""

from api.services.sql_repair import attempt_repair, repair_group_by, repair_type_mismatch


class TestRepairGroupBy:
    def test_adds_missing_column(self):
        sql = "SELECT a.name, b.val FROM t GROUP BY a.name ORDER BY b.val"
        error = 'column "b.val" must appear in the GROUP BY clause or be used in an aggregate function'
        result = repair_group_by(sql, error)
        assert result is not None
        assert "GROUP BY a.name, b.val" in result

    def test_handles_multiline_group_by(self):
        sql = (
            "SELECT a.name, ra.sequence\n"
            "FROM t\n"
            "GROUP BY a.name\n"
            "ORDER BY ra.sequence"
        )
        error = 'column "ra.sequence" must appear in the GROUP BY clause or be used in an aggregate function'
        result = repair_group_by(sql, error)
        assert result is not None
        assert "ra.sequence" in result
        assert "ORDER BY" in result

    def test_returns_none_for_unrelated_error(self):
        sql = "SELECT 1"
        error = "syntax error at position 5"
        result = repair_group_by(sql, error)
        assert result is None


class TestRepairTypeMismatch:
    def test_casts_service_date_to_date_key(self):
        sql = "SELECT * FROM fact_service_stop fss JOIN dim_date d ON fss.service_date = d.date_key"
        error = "operator does not exist: text = date\nLINE 1: fss.service_date = d.date_key"
        result = repair_type_mismatch(sql, error)
        assert result is not None
        assert "service_date::date = d.date_key" in result

    def test_casts_reverse_direction(self):
        sql = "SELECT * FROM dim_date d JOIN fact_service_stop fss ON d.date_key = fss.service_date"
        error = "operator does not exist: date = text\nLINE 1: d.date_key = fss.service_date"
        result = repair_type_mismatch(sql, error)
        assert result is not None
        assert "fss.service_date::date" in result

    def test_returns_none_for_unrelated_error(self):
        sql = "SELECT 1"
        error = "column does not exist"
        result = repair_type_mismatch(sql, error)
        assert result is None


class TestAttemptRepair:
    def test_tries_group_by_first(self):
        sql = "SELECT a.name FROM t GROUP BY a.name ORDER BY b.val"
        error = 'column "b.val" must appear in the GROUP BY clause'
        result = attempt_repair(sql, error)
        assert result is not None
        assert "b.val" in result

    def test_tries_type_mismatch(self):
        sql = "SELECT * FROM fss JOIN d ON fss.service_date = d.date_key"
        error = "operator does not exist: text = date\nLINE 1: fss.service_date = d.date_key"
        result = attempt_repair(sql, error)
        assert result is not None
        assert "::date" in result

    def test_returns_none_for_unknown_error(self):
        sql = "SELECT 1"
        error = "some unknown error"
        result = attempt_repair(sql, error)
        assert result is None
