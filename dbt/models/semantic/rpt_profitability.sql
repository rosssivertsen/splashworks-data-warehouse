{{ config(materialized='table') }}

-- Metabase-friendly profitability report: no IDs, human-readable columns
-- Wraps semantic_profit with customer location context and margin calculation

with profit as (
    select
        _company_name,
        customer_id,
        customer_name,
        service_month,
        rate_type,
        service_rate,
        labor_cost,
        dosage_cost,
        total_cost,
        profit,
        stop_count
    from {{ ref('semantic_profit') }}
),

customer_location as (
    select
        c.customer_id,
        c._company_name,
        c.billing_city,
        c.billing_state,
        count(distinct sl.service_location_id) as location_count
    from {{ ref('dim_customer') }} c
    left join {{ ref('dim_service_location') }} sl
        on c.customer_id = sl.customer_id
        and c._company_name = sl._company_name
    group by c.customer_id, c._company_name, c.billing_city, c.billing_state
)

select
    p._company_name as company,
    p.customer_name,
    cl.billing_city as city,
    cl.billing_state as state,
    cl.location_count as locations,
    p.service_month,
    p.rate_type,
    round(p.service_rate::numeric, 2) as service_rate,
    round(p.labor_cost::numeric, 2) as labor_cost,
    round(p.dosage_cost::numeric, 2) as dosage_cost,
    round(p.total_cost::numeric, 2) as total_cost,
    round(p.profit::numeric, 2) as profit,
    case
        when p.service_rate > 0
        then round((p.profit / p.service_rate * 100)::numeric, 1)
        else 0
    end as margin_pct,
    p.stop_count
from profit p
left join customer_location cl
    on p.customer_id = cl.customer_id
    and p._company_name = cl._company_name
order by p._company_name, p.service_month desc, p.profit desc
