-- Join page FAQ: "Are you part of Roblox?", added at the end of the list.
-- Officers own this content (/officer/content), so only add it if no question
-- like it is there yet and the list has room (20 at most). Like the original
-- seed, it isn't recorded as an officer's edit.
alter table public.join_faq disable trigger join_faq_record_edit;

insert into public.join_faq (position, question, answer)
select coalesce(max(position) + 1, 0),
       'Are you part of Roblox?',
       'No. We''re an independent student org. Roblox has partnered with us on events like our game jams and Player to Pro.'
from public.join_faq
having count(*) < 20
   and not coalesce(bool_or(question ilike 'Are you part of Roblox%'), false);

alter table public.join_faq enable trigger join_faq_record_edit;
