-- Harmony Residence — CORREÇÃO DE SEGURANÇA (escalada de privilégio).
--
-- Qualquer usuário logado conseguia, pela API, alterar o PRÓPRIO perfil —
-- inclusive `role` (virar SINDICO), `cadastro_validado` (se autovalidar no
-- autocadastro) e bloco/unidade (ganhar acesso aos dados de outra unidade).
-- Achado ao testar o autocadastro: uma conta criada pelo link aberto virou
-- Síndico com um único UPDATE. A falha é anterior ao autocadastro, mas o link
-- público a tornaria explorável por qualquer pessoa.
--
-- O app nunca escreve em profiles a partir do navegador: criação, validação,
-- correção e exclusão passam pelas rotas de servidor com service role (que
-- não é afetado por GRANT/RLS). Então o cliente fica só com leitura.

revoke insert, update, delete on public.profiles from anon, authenticated;
