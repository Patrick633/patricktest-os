# Life OS no iPhone + sincronização + notificações

Guia passo a passo. Leva uns 15 minutos, uma vez só.

---

## 1. Publicar o app (GitHub Pages)

O app precisa de um endereço na internet para abrir no iPhone.

1. No GitHub, abra o repositório **Patrick633/patricktest-os** → **Settings**.
2. **Tornar público:** em **General**, role até **Danger Zone** → **Change visibility** → **Make public**.
   - O *código* fica visível. Os seus *dados* (tarefas, hábitos…) nunca ficam no GitHub: ficam no aparelho e no seu Supabase.
3. **Ligar o Pages:** em **Pages** → *Build and deployment* → **Source: Deploy from a branch** → Branch **`claude/patricks-life-os-setup-lctcsw`** e pasta **`/ (root)`** → **Save**.
4. Espere 1–2 minutos. O endereço será:
   **https://patrick633.github.io/patricktest-os/**

## 2. Criar a sincronização (Supabase, grátis)

1. Crie uma conta em **https://supabase.com** → **New project** (escolha uma senha de banco e a região mais próxima, ex.: São Paulo).
2. **Criar a tabela:** menu **SQL Editor** → **New query** → cole todo o conteúdo do arquivo [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
3. **Login por código:** menu **Authentication** → **Emails** (ou *Email Templates*) → **Magic Link**. Troque o texto por:

   ```
   <h2>Seu código do Life OS</h2>
   <p>Digite este código no app: <strong>{{ .Token }}</strong></p>
   ```

   → **Save**. (Assim o e-mail traz um código de 6 dígitos, que funciona dentro do app do iPhone.)
4. **Pegar as chaves:** **Project Settings** → **API** (ou *Data API*). Copie:
   - **Project URL** (ex.: `https://abcdefgh.supabase.co`)
   - **anon public** key
5. Mande essas duas para o Claude colocar no arquivo `sync-config.js` (ou edite você mesmo). Elas podem ficar públicas: a chave *anon* é feita para isso, e a tabela só deixa cada pessoa ver os próprios dados.
6. **Depois de entrar pela primeira vez** (passo 3), em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**, para ninguém mais criar conta no seu projeto.

## 3. Entrar e sincronizar

**No Mac (onde estão seus dados):**
1. Abra o Life OS → ⚙️ **Settings** → **Sync across devices**.
2. Digite seu e-mail → **Send code** → digite o código que chegou → **Verify**.
3. Seus dados sobem para a nuvem. ✓

**No iPhone:**
1. Abra **https://patrick633.github.io/patricktest-os/** no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra o **Life OS pela tela de início** (não pelo Safari).
4. Na tela de boas-vindas toque em **“☁️ Already use Life OS on another device? Sign in to sync”**, use o **mesmo e-mail** e o código.
5. Pronto: os mesmos dados do Mac. ✓

> Se os dois aparelhos tiverem dados diferentes na primeira vez, o app pergunta qual versão manter. A outra vira um **backup** (Settings → Sync → Backups), nada se perde.

## 4. Notificações

**Notificações do app** (fim do timer de foco, aviso de hiperfoco, quiet time):
- iPhone com **iOS 16.4 ou mais novo**, app aberto **pela tela de início**.
- Settings → **Enable notifications** → **Permitir**.
- Funcionam enquanto o Life OS está aberto ou foi usado há pouco.

**Lembretes diários e de horário** (tocam mesmo com o app fechado, pelo Calendário):
1. Settings → **Daily reminders**: ligue os que quiser e ajuste os horários.
2. Toque em **📅 Add reminders to Calendar** → **Adicionar todos**.
3. Para blocos de horário (ex.: Church às 19h) e tarefas planejadas para um dia: **📅 Add time blocks & planned tasks** (ou o botão no card *Time blocks* da aba Today).

> Dica: se o botão de Calendário não abrir pelo app da tela de início, faça esse passo uma vez pelo Safari.

**Ainda por vir:** alertas de vulnerabilidades novas (CISA) e timers com o app totalmente fechado precisam de um pequeno servidor de push no Supabase. Depois que a sincronização estiver funcionando, é o próximo passo.

## 5. No Mac depois disso

Use **https://patrick633.github.io/patricktest-os/** também no Mac (salve nos favoritos). Não precisa mais de Terminal nem de baixar zip: cada atualização chega sozinha.

A extensão Life OS Companion também funciona nesse endereço. Depois de cada atualização da extensão, abra `chrome://extensions` e clique em **↻** no Life OS Companion. Por segurança, ela só conversa com esse endereço e com `localhost:8000`.
