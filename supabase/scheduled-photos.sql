create extension if not exists pg_cron;
create extension if not exists pg_net;

begin;

create table if not exists public.fb_photo_jobs (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  page_id text not null,
  due_at timestamptz not null,
  message text not null,
  image_data text,
  state text not null default 'pending'
    check (state in ('pending','publishing','published','review')),
  next_attempt timestamptz not null default now(),
  ticket uuid,
  updated_at timestamptz not null default now(),
  post_id text
);
alter table public.fb_photo_jobs enable row level security;
revoke all on public.fb_photo_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.fb_photo_jobs to service_role;
create index if not exists fb_photo_due on public.fb_photo_jobs(due_at)
  where state = 'pending';

-- The callback must claim its ticket before it can send the first image byte.
create or replace function public.fb_claim_photo(job_id text, job_ticket uuid, target_page text)
returns table(message text, image_data text)
language sql security invoker set search_path = '' as $$
  update public.fb_photo_jobs as j
     set state = 'publishing', ticket = null, updated_at = now()
   where j.id = job_id and j.ticket = job_ticket and j.page_id = target_page
     and j.state = 'pending' and j.due_at <= now()
  returning j.message, j.image_data;
$$;
revoke all on function public.fb_claim_photo(text,uuid,text) from public, anon, authenticated;
grant execute on function public.fb_claim_photo(text,uuid,text) to service_role;

create schema if not exists fb_campaign_private;
revoke all on schema fb_campaign_private from public, anon, authenticated;
create or replace function fb_campaign_private.dispatch_photos()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  job record;
  delivery_ticket uuid;
begin
  -- A crashed worker may already have sent the post. Leave it for manual review.
  update public.fb_photo_jobs set state = 'review', updated_at = now(), image_data = null
   where state = 'publishing' and updated_at < now() - interval '10 minutes';

  delete from public.fb_photo_jobs where state = 'published'
    and updated_at < now() - interval '30 days';

  for job in select id from public.fb_photo_jobs
    where state = 'pending' and due_at <= now() and next_attempt <= now()
    order by due_at limit 20 for update skip locked
  loop
    delivery_ticket := gen_random_uuid();
    update public.fb_photo_jobs set ticket = delivery_ticket, next_attempt = now() + interval '3 minutes'
     where id = job.id;
    perform net.http_post(
      url := 'https://f-bcampaign.vercel.app/api/deliver-scheduled-photo',
      body := jsonb_build_object('id', job.id, 'ticket', delivery_ticket),
      timeout_milliseconds := 175000
    );
  end loop;
end;
$$;
revoke all on function fb_campaign_private.dispatch_photos() from public, anon, authenticated;
select cron.schedule('fb-campaign-due-photos', '* * * * *',
  'select fb_campaign_private.dispatch_photos()');
commit;
