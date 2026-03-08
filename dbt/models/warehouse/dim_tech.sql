select
    company_id,
    _company_name,
    account_id as tech_id,
    first_name,
    last_name,
    full_name,
    role_type,
    is_active,
    can_manage_routes,
    can_manage_admin_panel,
    can_manage_settings
from {{ ref('stg_account') }}
