begin;

-- PostgreSQL 17 added the MAINTAIN table privilege. Supabase's historical
-- default ACL can retain it even after the older table privilege list is
-- revoked, so remove it explicitly for every Data API role. New migrations
-- must grant only the exact privileges their server-side surface needs.
alter default privileges for role postgres in schema public
  revoke maintain on tables from public, anon, authenticated, service_role;

commit;
