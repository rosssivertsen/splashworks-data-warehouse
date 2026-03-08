select
    c.company_id,
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    t.name as tag_name,
    case
        when max(case when t.name like '%Russells%' then 1 else 0 end) over (
            partition by c.clean_customer_name
        ) = 1
        then 'Russell''s'
        else 'A Quality Pool Service'
    end as clean_tag_name
from {{ ref('stg_customer') }} c
left join {{ ref('stg_customer_tag') }} ct
    on c.customer_id = ct.customer_id
left join {{ ref('stg_tag') }} t
    on ct.tag_id = t.tag_id
