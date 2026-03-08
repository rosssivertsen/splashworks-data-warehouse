select
    company_id,
    _company_name,
    customer_id,
    first_name,
    last_name,
    clean_customer_name,
    company_name,
    display_as_company,
    billing_city,
    billing_state,
    billing_zip,
    qbo_customer_id,
    is_inactive
from {{ ref('stg_customer') }}
