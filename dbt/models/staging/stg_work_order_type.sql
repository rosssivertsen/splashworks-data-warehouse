with source as (
    {{ union_companies('WorkOrderType') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as work_order_type_id,
        "Description" as name,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
