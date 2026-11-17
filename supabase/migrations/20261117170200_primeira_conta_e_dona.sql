-- A primeira conta criada no sistema vira a dona do grupo (acesso total a todas as empresas).
-- As contas seguintes começam sem acesso até receberem um papel numa empresa.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('primeira_dona_grupo'));
  insert into public.perfis (id, email, nome, dona_grupo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    not exists (select 1 from public.perfis where dona_grupo)
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;
