{{ config(materialized='table') }}

with customer_locations as (
    select
        sl.customer_id,
        sl._company_name,
        sl.rate,
        sl.rate_type,
        sl.labor_cost as location_labor_cost,
        sl.labor_cost_type
    from {{ ref('dim_service_location') }} sl
),

monthly_stops as (
    select
        fs.customer_id,
        fs._company_name,
        fs.service_month,
        count(case when fs.service_status = 1 then 1 end) as stop_count
    from {{ ref('fact_service_stop') }} fs
    group by fs.customer_id, fs._company_name, fs.service_month
),

monthly_labor as (
    select
        fl.customer_id,
        fl._company_name,
        fl.service_month,
        sum(case
            when fl.labor_cost_type = 'PerStop' and fl.service_status = 1
            then coalesce(fl.labor_cost, 0)
            else 0
        end) as per_stop_labor_cost,
        max(case
            when fl.labor_cost_type = 'PerMonth'
            then coalesce(fl.labor_cost, 0)
            else 0
        end) as per_month_labor_cost
    from {{ ref('fact_labor') }} fl
    group by fl.customer_id, fl._company_name, fl.service_month
),

monthly_dosage as (
    select
        fd.customer_id,
        fd._company_name,
        fd.service_month,
        sum(coalesce(fd.dosage_cost, 0)) as dosage_cost
    from {{ ref('fact_dosage') }} fd
    group by fd.customer_id, fd._company_name, fd.service_month
),

customer_rate as (
    select
        customer_id,
        _company_name,
        sum(coalesce(rate, 0)) as service_rate,
        max(rate_type) as rate_type
    from customer_locations
    group by customer_id, _company_name
)

select
    c._company_name,
    c.customer_id,
    c.clean_customer_name as customer_name,
    ms.service_month,
    cr.rate_type,
    cr.service_rate,
    coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) as labor_cost,
    coalesce(md.dosage_cost, 0) as dosage_cost,
    coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) + coalesce(md.dosage_cost, 0) as total_cost,
    cr.service_rate - (coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) + coalesce(md.dosage_cost, 0)) as profit,
    coalesce(ms.stop_count, 0) as stop_count
from {{ ref('dim_customer') }} c
inner join monthly_stops ms
    on c.customer_id = ms.customer_id
    and c._company_name = ms._company_name
left join customer_rate cr
    on c.customer_id = cr.customer_id
    and c._company_name = cr._company_name
left join monthly_labor ml
    on c.customer_id = ml.customer_id
    and c._company_name = ml._company_name
    and ms.service_month = ml.service_month
left join monthly_dosage md
    on c.customer_id = md.customer_id
    and c._company_name = md._company_name
    and ms.service_month = md.service_month
where c.is_inactive = 0
