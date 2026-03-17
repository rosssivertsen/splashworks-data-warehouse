from unittest.mock import MagicMock, patch, call
import logging

from api.services.audit_logger import log_query_audit


class TestLogQueryAudit:
    """Tests for the audit logger service."""

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_inserts_row_with_all_fields(self, mock_connect):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email="ross@splashworks.com",
            endpoint="/api/query",
            question="How many customers?",
            layer="warehouse",
            rewriter_confidence="high",
            generated_sql="SELECT count(*) FROM dim_customer",
            executed_sql="SELECT count(*) FROM dim_customer",
            was_repaired=False,
            status="success",
            row_count=1,
            duration_ms=1500,
            error_message=None,
        )

        mock_cur.execute.assert_called_once()
        sql_arg = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]

        assert "INSERT INTO public.query_audit_log" in sql_arg
        assert "%s" in sql_arg  # parameterized, not f-string
        assert params[0] == "1.2.3.4"
        assert params[1] == "ross@splashworks.com"
        assert params[2] == "/api/query"
        assert params[3] == "How many customers?"
        assert params[9] == "success"

        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_inserts_row_with_minimal_fields(self, mock_connect):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        log_query_audit(
            client_ip=None,
            cf_access_email=None,
            endpoint="/api/query/raw",
            status="success",
            row_count=5,
            duration_ms=200,
        )

        mock_cur.execute.assert_called_once()
        params = mock_cur.execute.call_args[0][1]
        assert params[0] is None  # client_ip
        assert params[1] is None  # cf_access_email
        assert params[2] == "/api/query/raw"

        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_does_not_raise_on_db_failure(self, mock_connect, caplog):
        mock_connect.side_effect = Exception("Connection refused")

        # Must not raise
        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email=None,
            endpoint="/api/query",
            status="success",
        )

        assert any("Audit log failed" in r.message for r in caplog.records)

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_closes_connection_on_insert_failure(self, mock_connect, caplog):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.execute.side_effect = Exception("INSERT failed")

        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email=None,
            endpoint="/api/query",
            status="error",
        )

        mock_conn.close.assert_called_once()
        assert any("Audit log failed" in r.message for r in caplog.records)
