from api.services.ai_service import extract_sql_from_response


def test_extract_sql_from_markdown_block():
    response = "Here's the query:\n```sql\nSELECT count(*) FROM dim_customer\n```"
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM dim_customer"


def test_extract_sql_from_plain_text():
    response = "SELECT count(*) FROM dim_customer"
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM dim_customer"


def test_extract_sql_multiline():
    response = """```sql
SELECT
    _company_name,
    count(*) as total
FROM public_warehouse.dim_customer
GROUP BY 1
```"""
    sql = extract_sql_from_response(response)
    assert "SELECT" in sql
    assert "GROUP BY" in sql


def test_extract_sql_with_explanation():
    response = """I'll query the customer dimension.

```sql
SELECT count(*) FROM public_warehouse.dim_customer
```

This counts all customers."""
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM public_warehouse.dim_customer"


def test_extract_sql_empty_response():
    sql = extract_sql_from_response("")
    assert sql is None


def test_extract_sql_no_sql_in_response():
    sql = extract_sql_from_response("I don't understand the question.")
    assert sql is None
