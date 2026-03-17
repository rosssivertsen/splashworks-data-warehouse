from api.services.query_executor import validate_sql


def test_select_allowed():
    assert validate_sql("SELECT * FROM warehouse.dim_customer") is None


def test_select_with_whitespace():
    assert validate_sql("  select count(*) from warehouse.dim_customer  ") is None


def test_select_with_cte():
    sql = "WITH cte AS (SELECT 1) SELECT * FROM cte"
    assert validate_sql(sql) is None


def test_insert_rejected():
    result = validate_sql("INSERT INTO warehouse.dim_customer VALUES (1)")
    assert result is not None
    assert "prohibited" in result.lower() or "not allowed" in result.lower()


def test_update_rejected():
    result = validate_sql("UPDATE warehouse.dim_customer SET name = 'x'")
    assert result is not None


def test_delete_rejected():
    result = validate_sql("DELETE FROM warehouse.dim_customer")
    assert result is not None


def test_drop_rejected():
    result = validate_sql("DROP TABLE warehouse.dim_customer")
    assert result is not None


def test_alter_rejected():
    result = validate_sql("ALTER TABLE warehouse.dim_customer ADD COLUMN x TEXT")
    assert result is not None


def test_multi_statement_rejected():
    result = validate_sql("SELECT 1; DROP TABLE warehouse.dim_customer")
    assert result is not None


def test_semicolon_in_string_allowed():
    sql = "SELECT * FROM warehouse.dim_customer WHERE name = 'foo;bar'"
    assert validate_sql(sql) is None


def test_empty_rejected():
    result = validate_sql("")
    assert result is not None


def test_none_rejected():
    result = validate_sql(None)
    assert result is not None


def test_dollar_quoting_rejected():
    result = validate_sql("SELECT * FROM t WHERE x = $$DROP TABLE t$$")
    assert result is not None
    assert "Dollar-quoted" in result


def test_escaped_quotes_handled():
    sql = "SELECT * FROM t WHERE name = 'it''s a test'"
    assert validate_sql(sql) is None


def test_escaped_quotes_in_string_are_safe():
    # In Postgres, 'test'' DROP TABLE t; --' is a single string literal
    # containing: test' DROP TABLE t; --
    # The DROP is inside the string, not executable SQL
    sql = "SELECT * FROM t WHERE name = 'test''; DROP TABLE t; --'"
    assert validate_sql(sql) is None


def test_real_escaped_quote_injection_rejected():
    # Actual injection: string ends, then DROP outside quotes
    result = validate_sql("SELECT * FROM t WHERE name = 'test'; DROP TABLE t; --")
    assert result is not None
