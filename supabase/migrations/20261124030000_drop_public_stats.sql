-- The site no longer shows site-wide totals, so stop exposing them.
-- public_past_event_counts() stays (aggregate "N attended" on past events).
drop function if exists public.public_stats();
