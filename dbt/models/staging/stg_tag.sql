with source as (
    {{ union_companies('Tag') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as tag_id,
        "Name" as name,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
