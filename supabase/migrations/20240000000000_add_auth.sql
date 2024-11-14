-- Add RLS policies for chat_histories
alter table public.chat_histories enable row level security;

create policy "Users can create their own chat histories"
  on public.chat_histories for insert
  with check (auth.uid() = user);

create policy "Users can view their own chat histories"
  on public.chat_histories for select
  using (auth.uid() = user);

create policy "Users can update their own chat histories"
  on public.chat_histories for update
  using (auth.uid() = user);

create policy "Users can delete their own chat histories"
  on public.chat_histories for delete
  using (auth.uid() = user);

-- Add RLS policies for collections
alter table public.collections enable row level security;

create policy "Users can create their own collections"
  on public.collections for insert
  with check (auth.uid() = user);

create policy "Users can view their own collections"
  on public.collections for select
  using (auth.uid() = user);

create policy "Users can update their own collections"
  on public.collections for update
  using (auth.uid() = user);

create policy "Users can delete their own collections"
  on public.collections for delete
  using (auth.uid() = user); 