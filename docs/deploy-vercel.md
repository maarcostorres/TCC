# Publicar o NextEducation na Vercel

Guia para colocar a plataforma no ar com o MongoDB Atlas como banco. É o mesmo MongoDB descrito no
artigo — não há troca de tecnologia aqui, apenas o cluster passa a ser acessado a partir das funções
da Vercel em vez da sua máquina.

## Antes de tudo: trocar a senha do Atlas

A senha do usuário `admin` do cluster está no histórico público deste repositório, no arquivo
`test-db.js` do commit `cb88004`. Apagar o arquivo não a remove do histórico — quem clonar o
repositório continua conseguindo lê-la:

```bash
git show cb88004:test-db.js
```

Trocar a senha invalida a credencial exposta, independentemente do que esteja no histórico. No
Atlas: **Database Access → usuário `admin` → Edit → Edit Password → Autogenerate Secure Password**.
Copie a senha nova antes de salvar; ela não é exibida de novo.

Depois disso, atualize o `MONGODB_URI` no seu `.env.local` e confira que o projeto ainda sobe:

```bash
npm run dev
```

## 1. Liberar o acesso de rede no Atlas

As funções da Vercel não têm IP fixo — cada invocação pode sair de um endereço diferente. Uma lista
de IPs permitidos com o endereço da sua casa vai recusar as conexões vindas da Vercel.

No Atlas: **Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`).

O que protege o banco nesse arranjo é a credencial, não o filtro de rede. Por isso a troca de senha
do passo anterior é pré-requisito, e não um detalhe.

> O cluster gratuito (M0) é pausado após 60 dias sem uso. Se a defesa estiver longe, entre no Atlas
> alguns dias antes e confirme que o cluster está ativo.

## 2. Gerar o segredo de sessão

O `SESSION_SECRET` assina o cookie de sessão (HMAC-SHA256, em `lib/auth.ts`). Gere um valor novo
para produção — o de desenvolvimento não deve ser reaproveitado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guarde-o. Trocar esse valor depois derruba todas as sessões abertas: os cookies já emitidos deixam
de validar e os usuários voltam para a tela de login.

## 3. Enviar o código para o GitHub

```bash
git add -A
git commit -m "chore: preparar deploy na Vercel"
git push origin main
```

Confirme que `.env.local` **não** foi junto — ele está no `.gitignore` pela regra `.env*`:

```bash
git ls-files | grep -c "^\.env\.local$"
```

O resultado tem que ser `0`.

## 4. Importar o projeto na Vercel

1. Entre em <https://vercel.com> com a conta do GitHub
2. **Add New → Project**
3. Escolha o repositório `maarcostorres/TCC` e clique em **Import**

O preset é detectado como Next.js: comando de build `next build`, diretório de saída `.next`. Não
mexa nesses campos.

Antes de clicar em **Deploy**, abra **Environment Variables** e cadastre as três — marcando
Production, Preview e Development em todas:

| Nome | Valor |
| --- | --- |
| `MONGODB_URI` | string de conexão do Atlas, já com a senha nova |
| `GROQ_API_KEY` | chave da Groq, começa com `gsk_` |
| `SESSION_SECRET` | o valor gerado no passo 2 |

Sobre a `MONGODB_URI`: use a string do botão **Connect → Drivers** no Atlas, substituindo
`<password>` pela senha real. Se a senha tiver caracteres como `@`, `:`, `/` ou `#`, eles precisam
ser codificados para URL (`@` vira `%40`) — senão o driver interpreta a senha como parte do
endereço do host. Aceitar a senha autogerada pelo Atlas evita esse problema.

Clique em **Deploy**. O primeiro build leva cerca de dois minutos.

> Se preferir cadastrar as variáveis pela linha de comando, `npx vercel env add MONGODB_URI
> production` faz o mesmo. O painel é mais simples para uma configuração única.

## 5. Verificar que subiu funcionando

Abra a URL gerada (`https://tcc-<algo>.vercel.app`) e siga esta ordem — cada passo exercita uma
camada diferente da arquitetura da Figura 1 do artigo:

1. **`/cadastro`** — crie uma conta. Se gravar, a aplicação está falando com o Atlas (camada Banco
   de Dados Externo)
2. **Tela inicial** — o aviso no topo deve estar verde, com "Tutor IA ativo". Amarelo significa que
   a `GROQ_API_KEY` não chegou à função ou não começa com `gsk_`
3. **Sincronizar agora** — deve reportar **135 questões sincronizadas** (45 de Ciências Humanas ×
   3 edições). Qualquer outro número indica problema na curadoria
4. **`/estudo`** — responda uma questão e espere a explicação. É o caminho completo:
   navegador → função → Groq → MongoDB
5. **`/stats`** — a latência média e o p95 devem aparecer preenchidos. São a evidência do requisito
   não funcional de baixa latência

Se algo falhar, os logs ficam em **Vercel → seu projeto → Logs**, com a mensagem lançada pelo
`console.error` da rota.

### Erros mais prováveis

| Sintoma | Causa |
| --- | --- |
| "Não foi possível conectar ao banco de dados" na tela inicial | `MONGODB_URI` errada, ou Network Access sem `0.0.0.0/0` |
| Sincronização devolve 0 questões, com o motivo da leitura no campo `descartes` | os arquivos de `data/` não chegaram ao pacote da função |
| Tutor responde com "Modo demonstração" | `GROQ_API_KEY` ausente ou sem o prefixo `gsk_` |
| Login aceita, mas volta para `/entrar` | `SESSION_SECRET` diferente entre um deploy e outro |

## 6. Latência e região (opcional)

O artigo trata a baixa latência como requisito não funcional e reporta a medição como resultado. A
região padrão das funções da Vercel é Washington, D.C. (`iad1`). Se o seu cluster do Atlas estiver
em São Paulo, cada consulta ao banco atravessa o continente duas vezes.

Em **Settings → Functions → Function Region**, escolher `gru1` (São Paulo) aproxima a função do
cluster. Vale medir antes e depois em `/stats`: a diferença aparece na latência registrada.

A latência da Groq não muda com isso — é uma chamada a um serviço externo, feita de qualquer
região.

## Depois do primeiro deploy

Cada `git push` na `main` gera um deploy novo automaticamente. Branches e pull requests ganham URLs
de pré-visualização próprias, úteis para testar uma mudança sem derrubar o endereço que você
entregou à banca.
