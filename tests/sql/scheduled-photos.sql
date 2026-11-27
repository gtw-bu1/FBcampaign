-- Run in a disposable project after supabase/scheduled-photos.sql.
-- pg_net releases requests only at commit; this fixture always rolls back.
begin;
do $test$
declare
  due_id text := repeat('a',64);
  future_id text := repeat('b',64);
  cancelled_id text := repeat('c',64);
  correct_ticket uuid;
  fake_ticket uuid := gen_random_uuid();
  n int;
begin
  if has_table_privilege('anon','public.fb_photo_jobs','SELECT')
     or has_table_privilege('authenticated','public.fb_photo_jobs','UPDATE')
     or has_function_privilege('anon','public.fb_claim_photo(text,uuid,text)','EXECUTE') then
    raise exception 'queue privileges are too broad';
  end if;
  if not exists(select 1 from cron.job where jobname='fb-campaign-due-photos' and active) then
    raise exception 'timer missing';
  end if;
  insert into public.fb_photo_jobs(id,page_id,due_at,message,image_data) values
    (due_id,'55555',now()-interval '1 minute','fixture','data'),
    (future_id,'55555',now()+interval '1 day','fixture','data'),
    (cancelled_id,'55555',now()-interval '1 minute','fixture','data');
  perform fb_campaign_private.dispatch_photos();
  select ticket into strict correct_ticket from public.fb_photo_jobs where id=due_id;
  if correct_ticket is null or (select ticket is not null from public.fb_photo_jobs where id=future_id) then
    raise exception 'dispatch time gate failed';
  end if;
  if exists(select 1 from public.fb_claim_photo(due_id,fake_ticket,'55555'))
     or exists(select 1 from public.fb_claim_photo(due_id,correct_ticket,'66666')) then
    raise exception 'unauthorized claim';
  end if;
  select count(*) into n from public.fb_claim_photo(due_id,correct_ticket,'55555');
  if n <> 1 then raise exception 'missing claim'; end if;
  if exists(select 1 from public.fb_claim_photo(due_id,correct_ticket,'55555')) then
    raise exception 'duplicate claim';
  end if;
  select ticket into strict correct_ticket from public.fb_photo_jobs where id=cancelled_id;
  delete from public.fb_photo_jobs where id=cancelled_id and state='pending';
  if exists(select 1 from public.fb_claim_photo(cancelled_id,correct_ticket,'55555')) then
    raise exception 'cancelled callback was accepted';
  end if;
  update public.fb_photo_jobs set updated_at=now()-interval '15 minutes' where id=due_id;
  perform fb_campaign_private.dispatch_photos();
  if (select state from public.fb_photo_jobs where id=due_id) <> 'review' then
    raise exception 'an interrupted upload must be held for review';
  end if;
end $test$;
rollback;
