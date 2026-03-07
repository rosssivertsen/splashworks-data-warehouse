{# Reusable macro for service completion detection.
   Skimmer uses '2010-01-01 12:00:00' as a sentinel for "not started/completed".
#}

{% macro service_status(start_time_col, complete_time_col) %}
    CASE
        WHEN {{ start_time_col }} != '2010-01-01 12:00:00'
         AND {{ complete_time_col }} != '2010-01-01 12:00:00'
        THEN 1
        ELSE 0
    END
{% endmacro %}
