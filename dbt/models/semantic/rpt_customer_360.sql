{{ config(materialized='table') }}

with customer_base as (
    select
        _company_name,
        customer_id,
        clean_customer_name,
        billing_city,
        billing_state,
        billing_zip,
        is_inactive,
        deleted,
        created_at,
        updated_at
    from {{ ref('dim_customer') }}
),

locations as (
    select
        customer_id,
        _company_name,
        count(*) as location_count
    from {{ ref('dim_service_location') }}
    group by customer_id, _company_name
),

pools as (
    select
        customer_id,
        _company_name,
        count(*) as pool_count
    from {{ ref('dim_pool') }}
    group by customer_id, _company_name
),

service_stats as (
    select
        customer_id,
        _company_name,
        count(*) as total_stops,
        count(case when service_status = 1 then 1 end) as completed_stops,
        min(service_date) as first_service_date,
        max(service_date) as last_service_date,
        round(avg(case when service_status = 1 then minutes_at_stop end)::numeric, 1) as avg_minutes_per_stop
    from {{ ref('fact_service_stop') }}
    group by customer_id, _company_name
),

invoice_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(line_total), 0) as total_invoiced,
        count(distinct invoice_id) as invoice_count
    from {{ ref('fact_invoice') }}
    group by customer_id, _company_name
),

payment_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(amount), 0) as total_payments,
        count(*) as payment_count,
        max(payment_date) as last_payment_date
    from {{ ref('fact_payment') }}
    group by customer_id, _company_name
),

profit_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(service_rate), 0) as total_revenue,
        coalesce(sum(total_cost), 0) as total_cost,
        coalesce(sum(profit), 0) as total_profit,
        case
            when count(service_month) > 0
            then round((sum(profit) / count(service_month))::numeric, 2)
            else 0
        end as avg_monthly_profit
    from {{ ref('semantic_profit') }}
    group by customer_id, _company_name
)

select
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    c.billing_city,
    c.billing_state,
    c.billing_zip,
    c.is_inactive,
    c.deleted,
    c.created_at,
    c.updated_at,

    -- portfolio
    coalesce(l.location_count, 0) as location_count,
    coalesce(p.pool_count, 0) as pool_count,

    -- service stats
    coalesce(ss.total_stops, 0) as total_stops,
    coalesce(ss.completed_stops, 0) as completed_stops,
    ss.first_service_date,
    ss.last_service_date,
    coalesce(ss.avg_minutes_per_stop, 0) as avg_minutes_per_stop,

    -- invoicing
    coalesce(inv.total_invoiced, 0) as total_invoiced,
    coalesce(inv.invoice_count, 0) as invoice_count,

    -- payments
    coalesce(pay.total_payments, 0) as total_payments,
    coalesce(pay.payment_count, 0) as payment_count,
    pay.last_payment_date,

    -- profitability
    coalesce(pr.total_revenue, 0) as total_revenue,
    coalesce(pr.total_cost, 0) as total_cost,
    coalesce(pr.total_profit, 0) as total_profit,
    coalesce(pr.avg_monthly_profit, 0) as avg_monthly_profit,

    -- lifetime value
    greatest(1,
        (date_part('year', age(
            coalesce(
                case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                current_date
            ),
            c.created_at::date
        )) * 12 +
        date_part('month', age(
            coalesce(
                case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                current_date
            ),
            c.created_at::date
        )))::int
    ) as tenure_months,

    coalesce(pr.total_profit, 0) as lifetime_value,

    round((coalesce(pr.total_profit, 0) /
        greatest(1,
            (date_part('year', age(
                coalesce(
                    case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                    current_date
                ),
                c.created_at::date
            )) * 12 +
            date_part('month', age(
                coalesce(
                    case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                    current_date
                ),
                c.created_at::date
            )))
        ))::numeric, 2
    ) as avg_monthly_value

from customer_base c
left join locations l
    on c.customer_id = l.customer_id and c._company_name = l._company_name
left join pools p
    on c.customer_id = p.customer_id and c._company_name = p._company_name
left join service_stats ss
    on c.customer_id = ss.customer_id and c._company_name = ss._company_name
left join invoice_stats inv
    on c.customer_id = inv.customer_id and c._company_name = inv._company_name
left join payment_stats pay
    on c.customer_id = pay.customer_id and c._company_name = pay._company_name
left join profit_stats pr
    on c.customer_id = pr.customer_id and c._company_name = pr._company_name
