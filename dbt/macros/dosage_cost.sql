{# Dosage cost and price calculation from FactDosage_v2 logic. #}

{% macro dosage_cost(entry_value_col, cost_col) %}
    COALESCE({{ entry_value_col }}, 0) * COALESCE({{ cost_col }}, 0)
{% endmacro %}

{% macro dosage_price(entry_value_col, price_col) %}
    COALESCE({{ entry_value_col }}, 0) * COALESCE({{ price_col }}, 0)
{% endmacro %}
