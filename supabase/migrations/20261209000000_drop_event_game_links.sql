-- Drop the old single-link table, replaced by event_game_servers
-- (20261208000000). The deployed app no longer reads or writes it; its rows
-- were copied over, and the mirror trigger that kept it in step is no longer
-- needed. Dropping the table also drops its policies and its broadcast
-- trigger. private.broadcast_game_link_change(), private.is_checked_in() and
-- private.can_read_game_link() stay: event_game_servers and the Realtime
-- policy for game:<event id> use them.

drop trigger if exists event_game_links_mirror on public.event_game_links;
drop function if exists private.mirror_legacy_game_link();
drop table if exists public.event_game_links;
