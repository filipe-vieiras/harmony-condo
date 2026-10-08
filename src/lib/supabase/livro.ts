// Acesso ao Livro de reclamações (migração 0043). Tudo passa por funções do banco (RPC): o navegador não tem INSERT, UPDATE
// nem DELETE nas tabelas do livro e nunca recebe id de autor. Erros voltam em português (erroDoLivro).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  erroDoLivro,
  erroEsperado,
  type LivroAcesso,
  type LivroCitavel,
  type LivroMensagem,
  type LivroModo,
  type LivroRemocao,
  type MotivoRemocao,
} from '@/lib/livro';

export type ResultadoLivro<T = unknown> = { ok: true; dados: T } | { ok: false; erro: string };

async function chamar<T>(supabase: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<ResultadoLivro<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // Recusa de regra (texto curto, limite...) é resposta normal: só falha inesperada vai para o console.
    if (!erroEsperado(error)) console.error(`${fn}:`, error.message);
    return { ok: false, erro: erroDoLivro(error) };
  }
  return { ok: true, dados: data as T };
}

export const livroAcesso = (s: SupabaseClient) => chamar<LivroAcesso>(s, 'livro_acesso');

export const livroListarTopicos = (s: SupabaseClient, depois?: { em: string; id: string }) =>
  chamar<LivroMensagem[]>(s, 'livro_listar_topicos', depois ? { p_antes_em: depois.em, p_antes_id: depois.id, p_limite: 20 } : { p_limite: 20 });

export const livroObterTopico = (s: SupabaseClient, id: string) => chamar<LivroMensagem | null>(s, 'livro_obter_topico', { p_id: id });

export const livroListarRespostas = (s: SupabaseClient, topico: string, depois?: { em: string; id: string }) =>
  chamar<LivroMensagem[]>(s, 'livro_listar_respostas', depois ? { p_topico: topico, p_depois_em: depois.em, p_depois_id: depois.id, p_limite: 30 } : { p_topico: topico, p_limite: 30 });

export const livroCitaveis = (s: SupabaseClient) => chamar<LivroCitavel[]>(s, 'livro_citaveis');

export const livroPublicar = (s: SupabaseClient, pai: string | null, texto: string, citados: string[]) =>
  chamar<{ ok: boolean; id: string; topicoId: string }>(s, 'livro_publicar', { p_pai: pai, p_texto: texto, p_citados: citados });

export const livroDarCiencia = (s: SupabaseClient) => chamar<{ ok: boolean }>(s, 'livro_dar_ciencia');

export const livroRemover = (s: SupabaseClient, id: string, motivo?: MotivoRemocao) =>
  chamar<{ ok: boolean; jaRemovida: boolean }>(s, 'livro_remover', { p_mensagem: id, p_motivo: motivo ?? null });

export const livroSinalizar = (s: SupabaseClient, id: string) => chamar<{ ok: boolean; jaAvisado: boolean }>(s, 'livro_sinalizar', { p_mensagem: id });

export const livroDefinirModo = (s: SupabaseClient, modo: LivroModo) => chamar<{ ok: boolean; modo: LivroModo }>(s, 'livro_definir_modo', { p_modo: modo });

export const livroRegistroRemocoes = (s: SupabaseClient, antes?: string) =>
  chamar<{ itens: LivroRemocao[]; resumo: { papel: string; total: number }[] }>(s, 'livro_registro_remocoes', antes ? { p_limite: 30, p_antes_em: antes } : { p_limite: 30 });
