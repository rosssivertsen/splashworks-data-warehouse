{{ config(materialized='table') }}

with date_spine as (
    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2024-01-01' as date)",
        end_date="cast('2027-12-31' as date)"
    ) }}
),

dates as (
    select
        cast(date_day as date) as date_key,
        extract(dow from date_day) as day_of_week,
        extract(day from date_day) as day_of_month,
        extract(week from date_day) as week_of_year,
        extract(month from date_day) as month_num,
        to_char(date_day, 'Month') as month_name,
        extract(quarter from date_day) as quarter,
        extract(year from date_day) as year,
        to_char(date_day, 'YYYY-MM') as year_month,
        case
            when extract(month from date_day) in (3,4,5) then 'Spring'
            when extract(month from date_day) in (6,7,8) then 'Summer'
            when extract(month from date_day) in (9,10,11) then 'Fall'
            else 'Winter'
        end as season
    from date_spine
)

select * from dates
