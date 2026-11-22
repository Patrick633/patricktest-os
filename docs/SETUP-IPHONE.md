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

## 2. Sincronização (Supabase) ✅ já configurada

O projeto `jgfrdrptqykiphszxnpd` já está pronto: tabela protegida (cada conta só vê os próprios dados), login por e-mail e o endereço do app. As chaves públicas já estão em `sync-config.js`.

> O plano grátis do Supabase manda um **link** de login por e-mail (não dá para trocar por código sem um servidor de e-mail próprio) e no máximo **2 e-mails por hora**.

## 3. Entrar e sincronizar

**No Mac (primeiro, onde estão seus dados):**
1. Abra **https://patrick633.github.io/patricktest-os/** → ⚙️ **Settings** → **Sync across devices**.
2. Digite seu e-mail → **Send code**.
3. Abra o e-mail **no Mac** e **clique no link**. O Life OS abre já conectado e seus dados sobem para a nuvem. ✓

**No iPhone (app da tela de início):**
1. Abra o **Life OS pelo ícone**. Na tela de boas-vindas toque em **“☁️ Already use Life OS on another device? Sign in to sync”** (ou ⚙️ → Sync).
2. Digite o **mesmo e-mail** → **Send code**.
3. No app **Mail**, **segure o dedo no link** → **Copiar Link**. (Não toque nele: isso abriria o Safari, que é separado do app.)
4. Volte ao Life OS, **cole o link** no campo e toque em **Sign in**. Os mesmos dados do Mac aparecem. ✓

> Se os dois aparelhos tiverem dados diferentes na primeira vez, o app pergunta qual manter. A outra vira **backup** (Settings → Sync → Backups), nada se perde.

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

**Alertas de vulnerabilidades (CISA):** um servidor no Supabase confere a lista da CISA a cada 2 horas e avisa no celular quando surge uma vulnerabilidade nova sendo explorada, **mesmo com o app fechado**.
1. Abra o Life OS **pelo ícone** (iPhone com iOS 16.4+) e entre na sincronização.
2. ⚙️ Settings → **☁️ Sync** → ligue **🛡️ Vulnerability alerts** → **Permitir**.
3. Toque em **Send a test alert** para conferir.
Faça isso em cada aparelho onde quiser receber.

## 5. No Mac depois disso

Use **https://patrick633.github.io/patricktest-os/** também no Mac (salve nos favoritos). Não precisa mais de Terminal nem de baixar zip: cada atualização chega sozinha.

A extensão Life OS Companion também funciona nesse endereço. Depois de cada atualização da extensão, abra `chrome://extensions` e clique em **↻** no Life OS Companion. Por segurança, ela só conversa com esse endereço e com `localhost:8000`.
