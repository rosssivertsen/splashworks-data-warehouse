select
    company_id,
    company_name,
    company_full_name
from {{ ref('company_lookup') }}
