{% snapshot snap_customer %}
{{
    config(
        target_schema='warehouse',
        unique_key="customer_id || _company_name",
        strategy='check',
        check_cols=['clean_customer_name', 'billing_city', 'billing_state', 'billing_zip', 'is_inactive', 'qbo_customer_id'],
    )
}}

select * from {{ ref('stg_customer') }}

{% endsnapshot %}
