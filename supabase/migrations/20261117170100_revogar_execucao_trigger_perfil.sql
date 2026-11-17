-- A função do trigger não deve ser chamável pela API (/rest/v1/rpc).
revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;
