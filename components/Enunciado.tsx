import { limparEnunciado, type QuestaoPublica } from '@/lib/enem';

type Props = {
  questao: Pick<QuestaoPublica, 'question' | 'description' | 'hasFigure'>;
  compacto?: boolean;
};

/**
 * Enunciado da questão.
 *
 * O dataset ENEM-Benchmark não distribui as imagens dos cadernos: no lugar
 * delas o enunciado traz `[[placeholder]]` e um campo `description` com a
 * descrição textual usada nas provas adaptadas para ledor. Exibir essa
 * descrição é o que mantém as questões com imagem respondíveis.
 */
export default function Enunciado({ questao, compacto = false }: Props) {
  const texto = limparEnunciado(questao.question);
  const paragrafos = texto.split('\n').filter((linha) => linha.trim() !== '');
  const descricao = questao.description.filter((linha) => linha.trim() !== '');

  return (
    <article className={`card-solid bg-[#09090b] ${compacto ? 'p-6' : 'p-6 sm:p-10'}`}>
      <div className="leading-relaxed text-sm text-slate-200">
        {paragrafos.map((paragrafo, i) => (
          <p key={i} className="mb-4 last:mb-0">
            {paragrafo}
          </p>
        ))}
      </div>

      {descricao.length > 0 && (
        <aside className="mt-8 p-4 border border-[#27272a] bg-[#18181b] rounded-sm">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Descrição da imagem da questão
          </h3>
          {descricao.map((linha, i) => (
            <p key={i} className="text-xs text-slate-400 leading-relaxed mb-2 last:mb-0">
              {linha}
            </p>
          ))}
        </aside>
      )}

      {questao.hasFigure && descricao.length === 0 && (
        <p className="mt-8 text-xs text-slate-500 italic">
          Esta questão original acompanha uma imagem que não está disponível no dataset.
        </p>
      )}
    </article>
  );
}
