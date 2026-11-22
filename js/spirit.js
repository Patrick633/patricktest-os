/* Life OS — Spirit: verse (or reflection) of the day, reading plans, gratitude,
   prayer / intentions list and a quiet-time timer. Progress is counted by what you
   do, never by a calendar you "fall behind" on. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { dkey, addDays, uid, esc, today, fmtDur, store } = window.LOS;
  const S = () => store.state;
  const SP = () => S().spirit;
  const app = () => window.LOS.app;

  // ---------------------------------------------------------------- content
  // [reference EN, reference PT, KJV text, Almeida (ARC) text]
  const VERSES = [
    ["Matthew 11:28", "Mateus 11:28", "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei."],
    ["Philippians 4:6", "Filipenses 4:6", "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.", "Não estejais inquietos por coisa alguma; antes, as vossas petições sejam em tudo conhecidas diante de Deus, pela oração e súplicas, com ação de graças."],
    ["Philippians 4:13", "Filipenses 4:13", "I can do all things through Christ which strengtheneth me.", "Posso todas as coisas naquele que me fortalece."],
    ["Proverbs 3:5-6", "Provérbios 3:5-6", "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.", "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas."],
    ["Isaiah 40:31", "Isaías 40:31", "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.", "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão e não se cansarão; caminharão e não se fatigarão."],
    ["Psalm 46:10", "Salmos 46:10", "Be still, and know that I am God.", "Aquietai-vos e sabei que eu sou Deus."],
    ["Joshua 1:9", "Josué 1:9", "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", "Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares."],
    ["Lamentations 3:22-23", "Lamentações 3:22-23", "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.", "As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim; novas são cada manhã; grande é a tua fidelidade."],
    ["Psalm 23:1", "Salmos 23:1", "The LORD is my shepherd; I shall not want.", "O Senhor é o meu pastor; nada me faltará."],
    ["Matthew 6:34", "Mateus 6:34", "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.", "Não vos inquieteis, pois, pelo dia de amanhã, porque o dia de amanhã cuidará de si mesmo. Basta a cada dia o seu mal."],
    ["Romans 8:28", "Romanos 8:28", "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.", "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, daqueles que são chamados por seu decreto."],
    ["2 Timothy 1:7", "2 Timóteo 1:7", "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", "Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação."],
    ["Psalm 118:24", "Salmos 118:24", "This is the day which the LORD hath made; we will rejoice and be glad in it.", "Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele."],
    ["Galatians 6:9", "Gálatas 6:9", "And let us not be weary in well doing: for in due season we shall reap, if we faint not.", "E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido."],
    ["Colossians 3:23", "Colossenses 3:23", "And whatsoever ye do, do it heartily, as to the Lord, and not unto men.", "E, tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens."],
    ["Psalm 119:105", "Salmos 119:105", "Thy word is a lamp unto my feet, and a light unto my path.", "Lâmpada para os meus pés é tua palavra e luz, para o meu caminho."],
    ["John 14:27", "João 14:27", "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.", "Deixo-vos a paz, a minha paz vos dou; não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize."],
    ["1 Peter 5:7", "1 Pedro 5:7", "Casting all your care upon him; for he careth for you.", "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós."],
    ["Jeremiah 29:11", "Jeremias 29:11", "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.", "Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais."],
    ["Isaiah 41:10", "Isaías 41:10", "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.", "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te esforço, e te ajudo, e te sustento com a destra da minha justiça."],
    ["Psalm 37:5", "Salmos 37:5", "Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.", "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará."],
    ["Matthew 6:33", "Mateus 6:33", "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.", "Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas."],
    ["Romans 12:2", "Romanos 12:2", "And be not conformed to this world: but be ye transformed by the renewing of your mind.", "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento."],
    ["Proverbs 16:3", "Provérbios 16:3", "Commit thy works unto the LORD, and thy thoughts shall be established.", "Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos."],
    ["Ecclesiastes 3:1", "Eclesiastes 3:1", "To every thing there is a season, and a time to every purpose under the heaven.", "Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu."],
    ["2 Corinthians 12:9", "2 Coríntios 12:9", "My grace is sufficient for thee: for my strength is made perfect in weakness.", "A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza."],
    ["James 1:5", "Tiago 1:5", "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.", "E, se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente e o não lança em rosto, e ser-lhe-á dada."],
    ["Psalm 139:14", "Salmos 139:14", "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.", "Eu te louvarei, porque de um modo terrível e tão maravilhoso fui formado; maravilhosas são as tuas obras, e a minha alma o sabe muito bem."],
    ["Hebrews 12:1", "Hebreus 12:1", "Let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us.", "Deixemos todo embaraço e o pecado que tão de perto nos rodeia e corramos, com paciência, a carreira que nos está proposta."],
    ["Micah 6:8", "Miqueias 6:8", "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?", "Ele te declarou, ó homem, o que é bom; e que é o que o Senhor pede de ti, senão que pratiques a justiça, e ames a beneficência, e andes humildemente com o teu Deus?"],
    ["Psalm 90:12", "Salmos 90:12", "So teach us to number our days, that we may apply our hearts unto wisdom.", "Ensina-nos a contar os nossos dias, de tal maneira que alcancemos coração sábio."],
  ];
  const REFLECTIONS = [
    ["You have power over your mind, not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
    ["We suffer more often in imagination than in reality.", "Seneca"],
    ["It's not what happens to you, but how you react to it that matters.", "Epictetus"],
    ["The happiness of your life depends upon the quality of your thoughts.", "Marcus Aurelius"],
    ["Begin at once to live, and count each separate day as a separate life.", "Seneca"],
    ["A journey of a thousand miles begins with a single step.", "Lao Tzu"],
    ["Waste no more time arguing what a good person should be. Be one.", "Marcus Aurelius"],
    ["First say to yourself what you would be; and then do what you have to do.", "Epictetus"],
    ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
    ["While we are postponing, life speeds by.", "Seneca"],
    ["No one is free who is not master of themselves.", "Epictetus"],
    ["Nature does not hurry, yet everything is accomplished.", "Lao Tzu"],
    ["Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", "Marcus Aurelius"],
    ["Difficulties strengthen the mind, as labor does the body.", "Seneca"],
    ["Wealth consists not in having great possessions, but in having few wants.", "Epictetus"],
  ];
  const PROMPTS = [
    "What's one thing you can let go of today?",
    "What would make today feel meaningful, even if it's small?",
    "Who could you be kind to today?",
    "What are you worrying about that you can't control?",
    "When did you feel most like yourself this week?",
    "What's one small promise you can keep to yourself today?",
    "What did you learn from a recent mistake?",
  ];

  // Bible books: [English, Portuguese, chapters]
  const BOOKS = [["Genesis","Gênesis",50],["Exodus","Êxodo",40],["Leviticus","Levítico",27],["Numbers","Números",36],["Deuteronomy","Deuteronômio",34],["Joshua","Josué",24],["Judges","Juízes",21],["Ruth","Rute",4],["1 Samuel","1 Samuel",31],["2 Samuel","2 Samuel",24],["1 Kings","1 Reis",22],["2 Kings","2 Reis",25],["1 Chronicles","1 Crônicas",29],["2 Chronicles","2 Crônicas",36],["Ezra","Esdras",10],["Nehemiah","Neemias",13],["Esther","Ester",10],["Job","Jó",42],["Psalms","Salmos",150],["Proverbs","Provérbios",31],["Ecclesiastes","Eclesiastes",12],["Song of Solomon","Cânticos",8],["Isaiah","Isaías",66],["Jeremiah","Jeremias",52],["Lamentations","Lamentações",5],["Ezekiel","Ezequiel",48],["Daniel","Daniel",12],["Hosea","Oseias",14],["Joel","Joel",3],["Amos","Amós",9],["Obadiah","Obadias",1],["Jonah","Jonas",4],["Micah","Miqueias",7],["Nahum","Naum",3],["Habakkuk","Habacuque",3],["Zephaniah","Sofonias",3],["Haggai","Ageu",2],["Zechariah","Zacarias",14],["Malachi","Malaquias",4],
    ["Matthew","Mateus",28],["Mark","Marcos",16],["Luke","Lucas",24],["John","João",21],["Acts","Atos",28],["Romans","Romanos",16],["1 Corinthians","1 Coríntios",16],["2 Corinthians","2 Coríntios",13],["Galatians","Gálatas",6],["Ephesians","Efésios",6],["Philippians","Filipenses",4],["Colossians","Colossenses",4],["1 Thessalonians","1 Tessalonicenses",5],["2 Thessalonians","2 Tessalonicenses",3],["1 Timothy","1 Timóteo",6],["2 Timothy","2 Timóteo",4],["Titus","Tito",3],["Philemon","Filemom",1],["Hebrews","Hebreus",13],["James","Tiago",5],["1 Peter","1 Pedro",5],["2 Peter","2 Pedro",3],["1 John","1 João",5],["2 John","2 João",1],["3 John","3 João",1],["Jude","Judas",1],["Revelation","Apocalipse",22]];
  const byName = (n) => BOOKS.findIndex((b) => b[0] === n);
  const range = (a, b) => BOOKS.slice(byName(a), byName(b) + 1);
  const PLANS = {
    gospels: { name: "The Gospels", days: 30, books: () => range("Matthew", "John"), hint: "30 days · ~3 chapters/day" },
    psprov: { name: "Psalms & Proverbs", days: 60, books: () => range("Psalms", "Proverbs"), hint: "60 days · ~3 chapters/day" },
    nt: { name: "New Testament", days: 90, books: () => range("Matthew", "Revelation"), hint: "90 days · ~3 chapters/day" },
    year: { name: "Whole Bible", days: 365, books: () => BOOKS, hint: "365 days · ~3-4 chapters/day" },
  };
  const planChapters = (id) => { const out = []; PLANS[id].books().forEach(([en, pt, n]) => { for (let c = 1; c <= n; c++) out.push([en, pt, c]); }); return out; };
  const planDay = (id, day) => {
    const all = planChapters(id), days = PLANS[id].days;
    return all.slice(Math.floor((day * all.length) / days), Math.floor(((day + 1) * all.length) / days));
  };
  const pt = () => SP().tradition === "christian-pt";
  const fmtChapters = (chs) => {
    const groups = [];
    chs.forEach(([en, ptn, c]) => {
      const g = groups[groups.length - 1];
      if (g && g.en === en && g.to === c - 1) g.to = c; else groups.push({ en, pt: ptn, from: c, to: c });
    });
    return {
      label: groups.map((g) => `${pt() ? g.pt : g.en} ${g.from}${g.to > g.from ? `–${g.to}` : ""}`).join("; "),
      query: groups.map((g) => `${g.en} ${g.from}${g.to > g.from ? `-${g.to}` : ""}`).join("; "),
    };
  };
  const gateway = (q) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=${pt() ? "ARC" : "KJV"}`;

  const dayOfYear = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 864e5); };
  const daily = () => {
    if (SP().tradition === "reflect") {
      const [text, who] = REFLECTIONS[dayOfYear() % REFLECTIONS.length];
      return { text, ref: who, note: "", prompt: PROMPTS[dayOfYear() % PROMPTS.length] };
    }
    const v = VERSES[dayOfYear() % VERSES.length];
    return pt() ? { text: v[3], ref: v[1], note: "Almeida (ARC)", query: v[0] } : { text: v[2], ref: v[0], note: "KJV", query: v[0] };
  };
  const last7 = (fn) => { let c = 0; for (let i = 0; i < 7; i++) if (fn(dkey(addDays(new Date(), -i)))) c++; return c; };

  // ---------------------------------------------------------------- quiet-time timer
  const ring = (frac, size = 120) => {
    const r = (size - 12) / 2, c = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--card-3)" stroke-width="10"/>
      <circle data-quiet-ring cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--vio);transition:stroke-dashoffset 1s linear" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" data-c="${c}"/></svg>`;
  };
  const quietLeft = () => { const q = SP().quietRun; return q ? q.dur * 60 - (Date.now() - q.start) / 1000 : 0; };
  setInterval(() => {
    const q = SP().quietRun;
    if (!q) return;
    const left = quietLeft();
    const el = document.querySelector("[data-quiet-left]");
    if (el) el.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : "0:00";
    const rg = document.querySelector("[data-quiet-ring]");
    if (rg) rg.setAttribute("stroke-dashoffset", String(Number(rg.dataset.c) * (1 - Math.max(0, left) / (q.dur * 60))));
    if (left <= 0) {
      SP().quiet[today()] = (SP().quiet[today()] || 0) + q.dur;
      SP().quietRun = null;
      window.LOS.fx.noiseOff();
      if (S().settings.sound) window.LOS.fx.bell();
      app().save(); app().render();
      app().toast(`🕊️ ${q.dur} minutes of quiet. Well done.`);
      app().notify("Quiet time done 🕊️", `${q.dur} minutes. Well done.`);
    }
  }, 1000);

  // ---------------------------------------------------------------- views
  const isChristian = () => SP().tradition && SP().tradition !== "reflect";

  const chooser = () => `
    <section class="view" data-view="spirit">
      <div class="hero"><div><h1>Spirit. <span>Be still.</span></h1><p>A few quiet minutes a day. Pick what fits you; you can change it anytime.</p></div></div>
      <div class="trad-pick">
        <button class="c" data-action="sp-trad" data-v="christian-en"><span class="e">✝️</span><b>Christian · English</b><small>Verse of the day (KJV), Bible reading plans, prayer list</small></button>
        <button class="c" data-action="sp-trad" data-v="christian-pt"><span class="e">✝️</span><b>Christian · Português</b><small>Versículo do dia (Almeida), planos de leitura, lista de oração</small></button>
        <button class="c" data-action="sp-trad" data-v="reflect"><span class="e">🌿</span><b>Reflection</b><small>Stoic & mindful quotes, a daily prompt, intentions</small></button>
      </div>
    </section>`;

  const view = () => {
    if (!SP().tradition) return chooser();
    const d = daily();
    const plan = SP().plan;
    const g = SP().gratitude[today()] || ["", "", ""];
    const prayers = SP().prayers.filter((p) => !p.answeredAt);
    const answered = SP().prayers.filter((p) => p.answeredAt);
    const q = SP().quietRun;
    const quietToday = SP().quiet[today()] || 0;
    const christian = isChristian();
    let reading = "";
    if (christian) {
      if (!plan.id) {
        reading = `<div class="c"><h3>Reading plan</h3><p class="mut" style="margin-bottom:12px;font-size:14px">Pick one. It moves forward when you read, not by the calendar, so you can never “fall behind”.</p>
          <div class="mini-list">${Object.entries(PLANS).map(([id, p]) => `<button class="mini-item" data-action="sp-plan" data-v="${id}"><span>📖</span><span class="t">${p.name}<br><small class="mut">${p.hint}</small></span><span class="add">Start</span></button>`).join("")}</div></div>`;
      } else {
        const P = PLANS[plan.id];
        const finished = plan.day >= P.days;
        const ch = finished ? null : fmtChapters(planDay(plan.id, plan.day));
        const readToday = !!plan.log[today()];
        reading = `<div class="c"><h3>${P.name} <span class="r mono">day ${Math.min(plan.day + 1, P.days)}/${P.days}</span></h3>
          ${finished ? `<div class="wins"><b>🎉</b><span>Plan complete! Pick another?</span></div><button class="btn ghost sm" data-action="sp-plan" data-v="">Choose a new plan</button>`
          : `<div class="read-today">${readToday ? "✓ Read today. Next up:" : "Today's reading:"}<b>${esc(ch.label)}</b></div>
            <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">
              <a class="btn ghost" href="${gateway(ch.query)}" target="_blank" rel="noopener">📖 Open reading</a>
              <button class="btn primary" data-action="sp-read">✓ I read it</button>
            </div>
            <div class="bar-soft"><i style="width:${(plan.day / P.days) * 100}%;background:var(--vio)"></i></div>
            <p class="mut" style="font-size:12px;margin-top:8px">${last7((k) => plan.log[k])} of last 7 days · <button class="tagbtn" data-action="sp-plan" data-v="">change plan</button></p>`}
        </div>`;
      }
    } else {
      reading = `<div class="c"><h3>Today's prompt</h3><p class="prompt">${esc(d.prompt)}</p>
        <form data-form="sp-reflect"><textarea class="field" name="text" placeholder="Write a few honest lines…">${esc((SP().reflections || {})[today()] || "")}</textarea><button class="btn ghost sm" style="margin-top:8px">Save</button></form></div>`;
    }

    return `
      <section class="view" data-view="spirit">
        <div class="hero"><div><h1>Spirit. <span>Be still.</span></h1><p>${christian ? "Time with God, a few honest minutes a day. Missing a day never resets anything." : "A few quiet minutes to come back to yourself."}</p></div></div>
        <div class="grid g-now">
          <div class="stack">
            <div class="c verse-card">
              <div class="label">${christian ? "Verse of the day" : "Reflection of the day"}</div>
              <blockquote>${esc(d.text)}</blockquote>
              <div class="verse-ref">${esc(d.ref)}${d.note ? ` <span class="mut">· ${d.note}</span>` : ""}</div>
              <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
                ${christian ? `<a class="btn sm ghost" href="${gateway(d.query)}" target="_blank" rel="noopener">Read in context</a>` : ""}
                <button class="btn sm ghost" data-action="sp-copy">Copy</button>
              </div>
            </div>
            ${reading}
            <div class="c">
              <h3>Gratitude <span class="r mut">${last7((k) => (SP().gratitude[k] || []).some(Boolean))} of last 7 days</span></h3>
              <form class="form-grid" data-form="sp-grat">
                ${[0, 1, 2].map((i) => `<input class="field" name="g${i}" value="${esc(g[i] || "")}" placeholder="${["I'm grateful for…", "Something good today…", "Someone I appreciate…"][i]}" maxlength="120" />`).join("")}
                <button class="btn ghost sm" style="justify-self:start">Save</button>
              </form>
              ${Object.entries(SP().gratitude).filter(([k, v]) => k !== today() && v.some(Boolean)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3).map(([k, v]) => `<div class="past-review" style="margin-top:8px"><small>${k}</small>${v.filter(Boolean).map((x) => `<p>🙏 ${esc(x)}</p>`).join("")}</div>`).join("")}
            </div>
          </div>
          <div class="stack">
            <div class="c quiet">
              <h3>${christian ? "Quiet time & prayer" : "Quiet time"} <span class="r mut">${last7((k) => SP().quiet[k])} of last 7 days</span></h3>
              ${q ? `<div class="quiet-run">${ring(Math.max(0, quietLeft()) / (q.dur * 60))}<div class="ql"><b data-quiet-left>${Math.floor(quietLeft() / 60)}:${String(Math.floor(quietLeft() % 60)).padStart(2, "0")}</b><small>breathe</small></div></div>
                <div class="row" style="gap:8px;justify-content:center;margin-top:12px">
                  <button class="btn sm ghost" data-action="sp-noise">${window.LOS.fx.noisePlaying() ? "🔇 Sound off" : "🎧 Soft noise"}</button>
                  <button class="btn sm quiet" data-action="sp-quiet-stop">Stop</button></div>`
              : `<p class="mut" style="font-size:14px;margin-bottom:12px">${quietToday ? `✓ ${fmtDur(quietToday)} today. ` : ""}Set a timer, put the phone down, ${christian ? "pray or just sit with God" : "and just breathe"}.</p>
                <div class="row" style="gap:6px;flex-wrap:wrap">${[3, 5, 10, 15, 20].map((m) => `<button class="chip" data-action="sp-quiet" data-m="${m}">${m} min</button>`).join("")}</div>`}
            </div>
            <div class="c">
              <h3>${christian ? "Prayer list" : "Intentions"} <span class="r mono">${prayers.length}</span></h3>
              <form class="inline-form" data-form="sp-prayer" style="margin-top:0"><input class="field" name="text" placeholder="${christian ? "Pray for…" : "I intend to…"}" maxlength="120" autocomplete="off" /><button class="btn sm primary">Add</button></form>
              <div class="mini-list" style="margin-top:10px">${prayers.map((p) => `
                <div class="mini-item"><span class="t">${esc(p.text)}<br><small class="mut">since ${p.at}</small></span>
                  <button class="tiny lime" data-action="sp-answer" data-id="${p.id}">${christian ? "Answered 🙏" : "Done ✓"}</button>
                  <button class="tiny" data-action="sp-del" data-id="${p.id}" aria-label="Remove">${window.LOS.icons.x}</button></div>`).join("") || `<p class="mut" style="font-size:13px">${christian ? "Add people and things you're praying for." : "Add how you want to show up."}</p>`}</div>
              ${answered.length ? `<details class="how"><summary>${christian ? "🙏 Answered" : "✓ Done"} (${answered.length})</summary>${answered.slice(-10).reverse().map((p) => `<p>✓ ${esc(p.text)} <span class="mut">· ${p.answeredAt}</span></p>`).join("")}</details>` : ""}
            </div>
            <div class="c">
              <h3>Settings</h3>
              <div class="seg" style="flex-wrap:wrap">${[["christian-en", "Christian · EN"], ["christian-pt", "Christian · PT"], ["reflect", "Reflection"]].map(([v, l]) => `<button class="${SP().tradition === v ? "on" : ""}" data-action="sp-trad" data-v="${v}">${l}</button>`).join("")}</div>
              <div class="set-row" style="border:0;padding-bottom:0"><div><b>Show on Now screen</b><small>${christian ? "Verse" : "Reflection"} of the day in the side column</small></div>
                <button class="switch ${SP().showOnNow ? "on" : ""}" data-action="sp-show" role="switch" aria-checked="${!!SP().showOnNow}" aria-label="Show on Now"></button></div>
            </div>
          </div>
        </div>
      </section>`;
  };

  /** small verse card for the Now screen */
  const nowCard = () => {
    if (!SP().tradition || !SP().showOnNow) return "";
    const d = daily();
    return `<button class="c verse-mini" data-action="nav" data-view="spirit"><span class="label" style="margin:0 0 8px">${isChristian() ? "Verse of the day" : "Reflection"}</span>
      <span class="vm-text">“${esc(d.text)}”</span><span class="vm-ref">${esc(d.ref)}</span></button>`;
  };

  // ---------------------------------------------------------------- actions
  const act = (a, el) => {
    if (!a.startsWith("sp-")) return false;
    const A = app();
    switch (a) {
      case "sp-trad": SP().tradition = el.dataset.v; break;
      case "sp-plan": SP().plan = { id: el.dataset.v || null, day: 0, log: {} }; if (el.dataset.v) A.toast(`📖 ${PLANS[el.dataset.v].name} started. One reading at a time.`); break;
      case "sp-read": {
        const plan = SP().plan;
        const prev = { day: plan.day, had: plan.log[today()] };
        plan.day += 1;
        plan.log[today()] = (plan.log[today()] || 0) + 1;
        A.save(); A.render();
        A.reward(plan.day >= PLANS[plan.id].days ? "Plan complete! 📖🎉" : "Reading done ✓", () => { plan.day = prev.day; if (prev.had) plan.log[today()] = prev.had; else delete plan.log[today()]; });
        return true;
      }
      case "sp-copy": {
        const d = daily();
        const txt = `“${d.text}” ${d.ref}`;
        try { navigator.clipboard.writeText(txt); A.toast("Copied ✓"); } catch { A.toast(txt); }
        return true;
      }
      case "sp-quiet": SP().quietRun = { start: Date.now(), dur: Number(el.dataset.m) }; break;
      case "sp-quiet-stop": {
        const q = SP().quietRun;
        const min = Math.round((Date.now() - q.start) / 60000);
        if (min >= 1) SP().quiet[today()] = (SP().quiet[today()] || 0) + min;
        SP().quietRun = null;
        window.LOS.fx.noiseOff();
        A.toast(min >= 1 ? `🕊️ ${fmtDur(min)} logged.` : "Stopped.");
        break;
      }
      case "sp-noise": window.LOS.fx.noisePlaying() ? window.LOS.fx.noiseOff() : window.LOS.fx.noiseOn(); setTimeout(A.render, 30); return true;
      case "sp-answer": {
        const p = SP().prayers.find((x) => x.id === el.dataset.id);
        p.answeredAt = today();
        A.save(); A.render();
        A.reward(isChristian() ? "Answered prayer 🙏 Worth remembering." : "Intention kept ✓", () => { p.answeredAt = null; });
        return true;
      }
      case "sp-del": SP().prayers = SP().prayers.filter((x) => x.id !== el.dataset.id); break;
      case "sp-show": SP().showOnNow = !SP().showOnNow; break;
      default: return false;
    }
    A.save(); A.render();
    return true;
  };

  const submit = (form, d) => {
    const A = app();
    switch (form.dataset.form) {
      case "sp-grat": {
        const vals = [d.g0, d.g1, d.g2].map((x) => (x || "").trim());
        const had = (SP().gratitude[today()] || []).some(Boolean);
        SP().gratitude[today()] = vals;
        A.save(); A.render();
        if (vals.some(Boolean) && !had) A.reward("Gratitude logged 🙏"); else A.toast("Saved ✓");
        return true;
      }
      case "sp-prayer":
        if (d.text && d.text.trim()) SP().prayers.unshift({ id: uid(), text: d.text.trim(), at: today(), answeredAt: null });
        A.save(); A.render();
        document.querySelector('form[data-form="sp-prayer"] input')?.focus();
        return true;
      case "sp-reflect":
        SP().reflections = SP().reflections || {};
        SP().reflections[today()] = (d.text || "").trim();
        A.save(); A.render(); A.toast("Saved ✓");
        return true;
      default: return false;
    }
  };

  window.LOS.spirit = { view, act, submit, nowCard, _planDay: planDay, _fmt: fmtChapters };
})();
