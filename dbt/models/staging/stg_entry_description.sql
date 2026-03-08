with source as (
    {{ union_companies('EntryDescription') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as entry_description_id,
        "Description" as description,
        "EntryType" as entry_type,
        "UnitOfMeasure" as unit_of_measure,
        "ReadingType" as reading_type,
        "DosageType" as dosage_type,
        cast("Cost" as double precision) as cost,
        cast("Price" as double precision) as price,
        cast("CanIncludeWithService" as integer) as can_include_with_service,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
