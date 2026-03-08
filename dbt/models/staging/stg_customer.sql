with source as (
    {{ union_companies('Customer') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as customer_id,
        "FirstName" as first_name,
        "LastName" as last_name,
        "CompanyName" as company_name,
        cast("DisplayAsCompany" as integer) as display_as_company,
        case
            when cast("DisplayAsCompany" as integer) = 1 then "CompanyName"
            else "FirstName" || ' ' || "LastName"
        end as clean_customer_name,
        "BillingAddress" as billing_address,
        "BillingCity" as billing_city,
        "BillingState" as billing_state,
        "BillingZip" as billing_zip,
        cast("QboCustomerId" as text) as qbo_customer_id,
        cast("IsInactive" as integer) as is_inactive,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
