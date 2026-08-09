/**
 * Restringe um destino de redirecionamento a rotas internas.
 *
 * O parâmetro `?proximo=` vem da URL e é controlado por quem monta o link, de
 * modo que aceitá-lo sem filtro permitiria enviar o aluno para um domínio
 * externo depois do login (open redirect). Só passam caminhos que começam com
 * uma única barra.
 */
export function rotaInternaSegura(destino: string | undefined, padrao = '/'): string {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//')) return padrao;

  return destino;
}
