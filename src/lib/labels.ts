import type { NoticeCategory } from '@/types';

/** Rótulos exibidos ao usuário para cada categoria de aviso do mural. */
export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  URGENTE: 'Urgente',
  MANUTENCAO: 'Manutenção',
  ASSEMBLEIA: 'Assembleia',
  COMUNICADO: 'Comunicado',
};
