select distinct
    company_id,
    _company_name,
    entry_description_id as chemical_id,
    description,
    entry_type,
    unit_of_measure,
    reading_type,
    dosage_type,
    cost,
    price,
    can_include_with_service
from {{ ref('stg_entry_description') }}
