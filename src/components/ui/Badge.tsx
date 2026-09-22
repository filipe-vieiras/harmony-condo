import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  icon?: ReactNode;
  /** Classes de cor (ex: "bg-emerald-100 text-emerald-800"). */
  className?: string;
  title?: string;
}

/**
 * Pílula de status/etiqueta. Fonte fixa em 12px (token body-sm do DESIGN.md)
 * e nowrap sempre — badge não deve crescer com o corpo de texto nem quebrar
 * linha dentro do rounded-full, senão vira um "blob" em colunas estreitas.
 */
export function Badge({ children, icon, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
