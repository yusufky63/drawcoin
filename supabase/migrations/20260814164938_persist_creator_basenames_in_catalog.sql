begin;

-- Market rows are the public read model. Once a Base primary name has been
-- resolved by the server-only cache, copy it into that read model so Explore
-- and Markets do not need a second identity request on future loads.
create index if not exists drawcoins_creator_address_lower_idx
  on public.drawcoins (lower(creator_address));

create or replace function private.sync_cached_creator_basename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.basename is not null then
    update public.drawcoins
    set creator_name = new.basename
    where lower(creator_address) = new.address
      and creator_name is distinct from new.basename;
  elsif tg_op = 'UPDATE' and old.basename is not null then
    -- Only remove a name that this cache previously supplied. A separate
    -- profile name must never be erased by a negative Base-name refresh.
    update public.drawcoins
    set creator_name = null
    where lower(creator_address) = new.address
      and creator_name = old.basename;
  end if;

  return new;
end;
$function$;

revoke all on function private.sync_cached_creator_basename()
  from public, anon, authenticated;
grant execute on function private.sync_cached_creator_basename()
  to service_role;

drop trigger if exists sync_cached_creator_basename
  on public.creator_identity_cache;
create trigger sync_cached_creator_basename
after insert or update of basename
on public.creator_identity_cache
for each row execute function private.sync_cached_creator_basename();

-- Propagate any names resolved between the cache migration and this migration.
update public.drawcoins as coin
set creator_name = cache.basename
from public.creator_identity_cache as cache
where cache.basename is not null
  and lower(coin.creator_address) = cache.address
  and coin.creator_name is distinct from cache.basename;

comment on function private.sync_cached_creator_basename() is
  'Copies server-resolved Base primary names into the public coin catalog without exposing the private cache.';

commit;
