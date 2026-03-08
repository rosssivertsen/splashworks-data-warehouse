with source as (
    {{ union_companies('Account') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as account_id,
        "FirstName" as first_name,
        "LastName" as last_name,
        "FirstName" || ' ' || "LastName" as full_name,
        "RoleType" as role_type,
        cast("IsActive" as integer) as is_active,
        cast("CanManageRoutes" as integer) as can_manage_routes,
        cast("CanManageAdminPanel" as integer) as can_manage_admin_panel,
        cast("CanManageSettings" as integer) as can_manage_settings,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
