-- Bloqueia leitura/gravação anônima do estado financeiro.
-- A chave pública do frontend só poderá acessar a tabela após login no Supabase Auth.

alter table public.app_states enable row level security;

revoke all on table public.app_states from anon;
grant select, insert, update on table public.app_states to authenticated;

-- Remove políticas antigas de mesmo propósito, caso existam.
drop policy if exists "app_states_authenticated_select" on public.app_states;
drop policy if exists "app_states_authenticated_insert" on public.app_states;
drop policy if exists "app_states_authenticated_update" on public.app_states;

create policy "app_states_authenticated_select"
on public.app_states
for select
to authenticated
using (id = 'garcia_turismo_main');

create policy "app_states_authenticated_insert"
on public.app_states
for insert
to authenticated
with check (id = 'garcia_turismo_main');

create policy "app_states_authenticated_update"
on public.app_states
for update
to authenticated
using (id = 'garcia_turismo_main')
with check (id = 'garcia_turismo_main');

-- Para mais de um usuário, substitua estas políticas por vínculo de tenant/empresa
-- ou por uma allowlist de auth.uid().
