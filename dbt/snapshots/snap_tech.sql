{% snapshot snap_tech %}
{{
    config(
        target_schema='warehouse',
        unique_key="account_id || _company_name",
        strategy='check',
        check_cols=['full_name', 'role_type', 'is_active', 'can_manage_routes', 'can_manage_admin_panel'],
    )
}}

select * from {{ ref('stg_account') }}

{% endsnapshot %}
