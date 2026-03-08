{# Union a raw table across all companies.
   Usage: {{ union_companies('Customer') }}
   Returns: SELECT *, 'AQPS' as _company_name FROM raw_skimmer."AQPS_Customer" UNION ALL ...
#}

{% macro union_companies(table_name) %}
    SELECT *, 'AQPS' AS _company_name
    FROM {{ source('raw_skimmer', 'AQPS_' ~ table_name) }}

    UNION ALL

    SELECT *, 'JOMO' AS _company_name
    FROM {{ source('raw_skimmer', 'JOMO_' ~ table_name) }}
{% endmacro %}
