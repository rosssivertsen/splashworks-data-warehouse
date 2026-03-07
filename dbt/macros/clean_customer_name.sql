{# Clean customer name: remove carriage returns and line feeds. #}

{% macro clean_customer_name(first_name_col, last_name_col) %}
    REPLACE(
        REPLACE(
            COALESCE({{ first_name_col }}, '') || ' ' || COALESCE({{ last_name_col }}, ''),
            CHR(10), ''
        ),
        CHR(13), ''
    )
{% endmacro %}
