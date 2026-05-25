-- Trava is_admin contra auto-elevação via UPDATE pelo cliente
-- Defesa em profundidade: a RLS atual permite UPDATE em qualquer coluna
-- por authenticated.uid = id. Sem isto, um usuário poderia executar
-- supabase.from('profiles').update({ is_admin: true }).eq('id', user.id)
-- e ganhar privilégios de admin.

create or replace function public.prevent_self_admin_elevation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / migrations / Supabase Dashboard: sem auth context — permite.
  if auth.uid() is null then
    return new;
  end if;

  -- Admin pode mudar is_admin de qualquer perfil (mesmo o próprio).
  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ) then
    return new;
  end if;

  -- Para todos os outros: is_admin não pode ser alterado pelo UPDATE.
  if new.is_admin is distinct from old.is_admin then
    raise exception 'Permissão negada: is_admin não pode ser alterado pelo próprio usuário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_admin_elevation on public.profiles;

create trigger trg_prevent_self_admin_elevation
  before update on public.profiles
  for each row
  execute function public.prevent_self_admin_elevation();
