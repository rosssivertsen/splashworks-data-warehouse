with source as (
    {{ union_companies('SkippedStopReason') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as skipped_stop_reason_id,
        "Reason" as reason,
        cast("Sequence" as integer) as sequence,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
