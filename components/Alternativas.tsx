'use client';

import { ALTERNATIVAS, type Alternativa } from '@/lib/enem';

type Props = {
  alternativas: string[];
  selecionada: Alternativa | null;
  /** Definido apenas após a correção, para destacar a alternativa certa. */
  gabarito?: Alternativa | null;
  bloqueada?: boolean;
  onSelecionar: (letra: Alternativa) => void;
};

/**
 * Lista de alternativas com semântica de grupo de rádio.
 *
 * Botões soltos não comunicam a leitores de tela que as opções são mutuamente
 * exclusivas nem quantas existem; `role="radiogroup"` + `role="radio"` sim.
 */
export default function Alternativas({
  alternativas,
  selecionada,
  gabarito = null,
  bloqueada = false,
  onSelecionar,
}: Props) {
  const corrigida = gabarito !== null;

  return (
    <div role="radiogroup" aria-label="Alternativas da questão" className="space-y-3">
      {alternativas.map((texto, indice) => {
        const letra = ALTERNATIVAS[indice];
        if (!letra) return null;

        const escolhida = selecionada === letra;
        const correta = corrigida && letra === gabarito;
        const erradaEscolhida = corrigida && escolhida && letra !== gabarito;

        let estilo = 'border-[#27272a] bg-[#18181b] text-slate-300';
        if (!corrigida && !bloqueada) estilo += ' hover:border-slate-600';
        if (escolhida) estilo = 'border-blue-600 bg-[#09090b] text-white';
        if (correta) estilo = 'border-green-600 bg-green-950/20 text-white';
        if (erradaEscolhida) estilo = 'border-red-800 bg-red-950/20 text-slate-400';

        const marcador =
          escolhida || correta
            ? 'border-transparent bg-white text-black'
            : 'border-[#27272a] text-slate-500';

        return (
          <button
            key={letra}
            type="button"
            role="radio"
            aria-checked={escolhida}
            // O nome vem de um rótulo explícito porque a letra fica em um span
            // decorativo: sem isso o leitor de tela anunciaria só o texto solto,
            // sem dizer de qual alternativa se trata.
            aria-label={`Alternativa ${letra}: ${texto}${correta ? ' (gabarito)' : ''}`}
            disabled={bloqueada || corrigida}
            onClick={() => onSelecionar(letra)}
            className={`w-full text-left p-4 rounded-md border transition-colors flex items-start gap-4 disabled:cursor-default ${estilo}`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 w-6 h-6 shrink-0 rounded flex items-center justify-center text-xs font-semibold border ${marcador}`}
            >
              {letra}
            </span>

            <span className="flex-1 text-sm leading-relaxed">{texto}</span>

            {correta && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-green-400 shrink-0 mt-1.5">
                Gabarito
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
