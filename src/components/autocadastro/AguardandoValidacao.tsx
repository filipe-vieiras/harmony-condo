import Link from 'next/link';
import { Hourglass } from 'lucide-react';

export function AguardandoValidacao({ recurso }: { recurso: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Hourglass className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-bold text-amber-900">Disponível após a validação do seu cadastro</h2>
      <p className="mx-auto mt-2 max-w-md text-xs text-amber-800">
        {recurso} da sua unidade aparecem assim que o síndico confirmar o seu cadastro. Enquanto isso, você pode acompanhar o mural e conferir a lista de unidades.
      </p>
      <Link href="/" className="mt-4 inline-block text-xs font-semibold text-[#0A6E9C] hover:underline">
        Ver meu cadastro
      </Link>
    </div>
  );
}
