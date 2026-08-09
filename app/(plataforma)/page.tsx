import Link from 'next/link';
import { attemptsCollection, questionsCollection } from '@/lib/db';
import { AREA_ALVO } from '@/lib/enem';
import { iaConfigurada } from '@/lib/groq';
import { getSessao } from '@/lib/session';
import BotaoSincronizar from '@/components/BotaoSincronizar';

type Painel = {
  questoes: number;
  edicoes: number;
  respondidas: number;
  taxaAcerto: number | null;
  indisponivel: boolean;
};

async function carregarPainel(userId: string): Promise<Painel> {
  try {
    const questions = await questionsCollection();
    const attempts = await attemptsCollection();

    const [questoes, edicoes, tentativas, acertos] = await Promise.all([
      questions.countDocuments({ area: AREA_ALVO }),
      questions.distinct('exam', { area: AREA_ALVO }),
      attempts.countDocuments({ userId }),
      attempts.countDocuments({ userId, acertou: true }),
    ]);

    return {
      questoes,
      edicoes: edicoes.length,
      respondidas: tentativas,
      taxaAcerto: tentativas > 0 ? Math.round((acertos / tentativas) * 100) : null,
      indisponivel: false,
    };
  } catch (erro) {
    // O painel não deve ficar em branco quando o cluster está fora do ar.
    console.error('Falha ao carregar o painel:', erro);

    return { questoes: 0, edicoes: 0, respondidas: 0, taxaAcerto: null, indisponivel: true };
  }
}

export default async function InicioPage() {
  const sessao = await getSessao();
  const painel = await carregarPainel(sessao!.sub);
  const iaAtiva = iaConfigurada();

  const primeiroNome = sessao!.nome.split(/\s+/)[0];
  const bancoVazio = !painel.indisponivel && painel.questoes === 0;

  const cartoes = [
    {
      rotulo: 'Questões disponíveis',
      valor: painel.questoes.toString(),
      detalhe: `Ciências Humanas · ${painel.edicoes} ${painel.edicoes === 1 ? 'edição' : 'edições'} do ENEM`,
    },
    {
      rotulo: 'Questões que você respondeu',
      valor: painel.respondidas.toString(),
      detalhe:
        painel.respondidas === 0 ? 'Comece pelo módulo de estudos' : 'Histórico salvo na sua conta',
    },
    {
      rotulo: 'Seu aproveitamento',
      valor: painel.taxaAcerto === null ? '—' : `${painel.taxaAcerto}%`,
      detalhe:
        painel.taxaAcerto === null ? 'Responda algumas questões' : 'Sobre todas as suas respostas',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-md text-sm text-slate-300">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${iaAtiva ? 'bg-green-500' : 'bg-amber-500'}`}
          aria-hidden="true"
        />
        <span>
          {iaAtiva
            ? 'Tutor IA ativo — explicações geradas pelo modelo Llama 3.3 via Groq.'
            : 'Tutor IA em modo demonstração — defina GROQ_API_KEY no .env.local para ativar o modelo.'}
        </span>
      </div>

      <section>
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-4">
          Olá, {primeiroNome}
        </h1>
        <p className="text-slate-400 max-w-2xl leading-relaxed text-sm">
          Estude Ciências Humanas com questões oficiais do ENEM. A cada resposta você recebe uma
          explicação do porquê da alternativa correta, e seu desempenho fica registrado para você
          acompanhar a evolução.
        </p>

        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/estudo" className="btn-primary">
            Estudar questões
          </Link>
          <Link href="/simulado" className="btn-secondary">
            Fazer uma mini prova
          </Link>
        </div>
      </section>

      {painel.indisponivel && (
        <p
          role="alert"
          className="text-sm text-red-400 border border-red-900/50 bg-red-950/20 rounded-md p-4"
        >
          Não foi possível conectar ao banco de dados. Verifique a variável MONGODB_URI no arquivo{' '}
          <code>.env.local</code>.
        </p>
      )}

      {bancoVazio && (
        <p
          role="alert"
          className="text-sm text-amber-300 border border-amber-900/50 bg-amber-950/20 rounded-md p-4"
        >
          Ainda não há questões no banco. Use o botão de sincronização abaixo para carregar o
          dataset ENEM-Benchmark.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cartoes.map((cartao) => (
          <div
            key={cartao.rotulo}
            className="card-solid p-6 flex flex-col justify-between gap-6 min-h-36"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {cartao.rotulo}
            </p>
            <div>
              <p className="text-3xl font-semibold text-white">{cartao.valor}</p>
              <p className="text-xs text-slate-400 mt-1">{cartao.detalhe}</p>
            </div>
          </div>
        ))}
      </div>

      <BotaoSincronizar />
    </div>
  );
}
