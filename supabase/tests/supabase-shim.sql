-- Minimal stand-in for the parts of Supabase that the migration depends on, so
-- migrations and security tests can run in PGlite without Docker. NOT used in
-- production; the hosted project already has the real versions.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
grant anon, authenticated, service_role to postgres;

create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated;

-- Supabase grants everything on public tables to the API roles by default;
-- mimic that so the migration's explicit revokes are actually exercised.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create publication supabase_realtime;
