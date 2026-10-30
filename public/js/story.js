// ============================================================
// Monster Arena — Story Mode (singleplayer / offline)
// A plot-driven campaign layered over the arena engine. Each
// realm is a CHAPTER with a story objective, a named villain who
// taunts you mid-fight, and a boss whose defeat advances the plot.
// Flow: Prologue → (Chapter: intro cutscene → trial with mid-fight
// dialogue + objective HUD → boss defeat → outro cutscene) ×5 →
// Ending choice. Progress persists in localStorage. Multiplayer
// story sync is deferred until integration credits are restored.
// ============================================================
(function () {
  'use strict';

  // ---- The plot ----------------------------------------------------------
  // The Last Scribe carries the last readable glyph. Five seals imprison
  // the Hollow — once a person, broken by the glyphs. The Archivist, who
  // raised the seals, sacrificed the Scribe to make them. Each realm's
  // warden holds a fragment. Recover all five and choose the Hollow's fate.
  const PROLOGUE = [
    { who: 'The Last Scribe', text: 'I wake in a place I do not know, wearing a name I barely remember — the Last Scribe.' },
    { who: 'The Hollow', text: 'Another scribe wakes. Another soul to devour. Do you know how many ages I have waited behind these seals?' },
    { who: 'The Hollow', text: 'I am no creation of yours, little scribe. I am the Hollow King of Nhalori — an empire that crumbled to dust while I endured. I am the hunger that outlasts civilisations.' },
    { who: 'The Last Scribe', text: 'The First Scribe sealed you centuries ago. Their soul was shattered into five — each shard bound to a Warden to hold your prison shut. I carry that soul now.' },
    { who: 'The Hollow', text: 'Then come. Slay my Wardens. Reclaim what was theirs. And when you are whole, I will show you the power that made me — and the price of refusing to die.' }
  ];

  const REALMS = [
    {
      id: 1, levelId: 1, name: 'Meadow of First Light', accent: '#7dffa3', icon: '🌿',
      boss: 'The Hearth Warden', power: 'Nature · thorn & spore',
      objective: 'Reclaim the First Soul-Shard',
      lore: 'The First Scribe sealed the Hollow centuries ago, shattering their soul into five shards bound to Wardens. The first shard — courage — was caged in the Meadow, where ancient Nhalori ruins lie buried beneath the roots.',
      villain: 'The Hearth Warden',
      open: { who: 'The Hearth Warden', text: 'A piece of the Scribe wakes inside me. I was their courage — now I am its warden. The roots here grow over ruins older than your seals, little scribe.' },
      bossTaunt: { who: 'The Hearth Warden', text: 'I am the first shard. Break me, and remember what the Hollow truly is — not your creation, but an ancient hunger.' },
      mid: [
        { who: 'The Last Scribe', text: 'Beneath the roots... carved stones. Glyphs older than any I know. What lived here before the seals?' },
        { who: 'The Hearth Warden', text: 'Nhalori. An empire that devoured itself for power. The Hollow was its king. The ruins remember.' }
      ],
      intro: [
        { who: 'The Last Scribe', text: 'The Hollow shattered my soul into five. The first shard was given to the Hearth Warden, here in the Meadow of First Light.' },
        { who: 'The Last Scribe', text: 'The Warden was born from my courage. To defeat it is to take that courage back — and learn what lies buried beneath.' },
        { who: 'The Last Scribe', text: 'Break the Warden. Recover the first shard of my soul.' }
      ],
      outro: [
        { who: 'The Last Scribe', text: 'The Hearth Warden falls — and a piece of my soul returns, warm and whole. But the ruins beneath whisper of an empire called Nhalori.' },
        { who: 'The Hollow', text: 'You feel it now, don\'t you? The old magic beneath your feet. I was old when your Scribe was born. I am the Hollow King of Nhalori.' },
        { who: 'The Last Scribe', text: 'The Sunken Dunes hold the second shard — and perhaps more of the truth.' }
      ]
    },
    {
      id: 2, levelId: 2, name: 'The Sunken Dunes', accent: '#ffd166', icon: '🔺',
      boss: 'The Pharaoh of Glass', power: 'Sand · storms & mirrors',
      objective: 'Reclaim the Second Soul-Shard',
      lore: 'The second shard — memory — was buried with the Pharaoh of Glass beneath a Nhalori city built to cage it. The Pharaoh wears the Scribe\'s face and conjures sandstorms to guard the truth.',
      villain: 'The Pharaoh of Glass',
      open: { who: 'The Pharaoh of Glass', text: 'I am your memory, Scribe. I have buried a hundred to keep it safe. The city above me is older than your seals — it was old when the Scribe came.' },
      bossTaunt: { who: 'The Pharaoh of Glass', text: 'Strike me, and strike the part of you that still knows its own name. The Hollow King ruled here, once.' },
      mid: [
        { who: 'The Last Scribe', text: 'The buried city... its architecture is Nhalori. They bound souls into monuments to preserve their empire.' },
        { who: 'The Pharaoh of Glass', text: 'The Hollow King sought to live forever. He consumed his own people to do it. I hold your memory so you may learn from his mistake.' }
      ],
      intro: [
        { who: 'The Last Scribe', text: 'The Sunken Dunes bury a Nhalori city that cages the second shard — my memory.' },
        { who: 'The Last Scribe', text: 'The Pharaoh of Glass wears my own face and conjures sandstorms to guard it.' },
        { who: 'The Last Scribe', text: 'Shatter the Pharaoh. Take back the part of me that remembers.' }
      ],
      outro: [
        { who: 'The Last Scribe', text: 'Glass shatters — and my memory returns, sharp and whole. I remember the Nhalori now... their hunger, their fall.' },
        { who: 'The Hollow', text: 'Now you remember it all, Scribe. I was the King of Nhalori. I devoured my own empire to become eternal. Your Scribe sealed me — but I have waited.' },
        { who: 'The Last Scribe', text: 'The Glacial Archive lies ahead. There the truth was frozen to keep it unread.' }
      ]
    },
    {
      id: 3, levelId: 3, name: 'The Glacial Archive', accent: '#9fe3ff', icon: '❄️',
      boss: 'The Rime Oracle', power: 'Frost · shards & deep freeze',
      objective: 'Reclaim the Third Soul-Shard',
      lore: 'The third shard — foresight — was frozen in the Glacial Archive to keep the truth of the Hollow\'s origin from ever being read. The Oracle guards the secret: the Hollow was once a mortal king who chose power over his own people.',
      villain: 'The Rime Oracle',
      open: { who: 'The Rime Oracle', text: 'I am your foresight, Scribe. I froze myself to hide what you would rather not know. The Hollow was a mortal king — a man who chose power over his own people.' },
      bossTaunt: { who: 'The Rime Oracle', text: 'I kept the secret for centuries. The Hollow King was human once. He chose this. Let me show you.' },
      mid: [
        { who: 'The Last Scribe', text: 'These frozen records... they show the Nhalori King. He was human. He wanted too much power, and the glyph magic consumed him.' },
        { who: 'The Rime Oracle', text: 'He was not always a monster. He was a man who refused to let his empire die. He sacrificed his people to preserve himself. The First Scribe sealed what remained.' }
      ],
      intro: [
        { who: 'The Last Scribe', text: 'The Glacial Archive freezes the third shard — my foresight — to keep a terrible truth unread.' },
        { who: 'The Last Scribe', text: 'The Rime Oracle, born of that foresight, strikes with killing frost and shard volleys.' },
        { who: 'The Last Scribe', text: 'Thaw the Oracle. Recover my sight — and the truth I buried.' }
      ],
      outro: [
        { who: 'The Last Scribe', text: 'The Oracle thaws — and my foresight returns, and with it the full truth. The Hollow was the King of Nhalori — a human who chose power over everyone.' },
        { who: 'The Hollow', text: 'You see it now. I was a king. I could have let my empire fade, but I refused. I devoured my people and became this. The First Scribe sealed me centuries later — a child who found my prison.' },
        { who: 'The Last Scribe', text: 'The Cinder Below waits. There the First Scribe forged the seals — from the Hollow\'s own magic.' }
      ]
    },
    {
      id: 4, levelId: 4, name: 'The Cinder Below', accent: '#ff7a66', icon: '🌋',
      boss: 'The Magma Titan', power: 'Fire · eruptions & burn',
      objective: 'Reclaim the Fourth Soul-Shard',
      lore: 'The fourth shard — will — was chained to the Magma Titan in the forge where the First Scribe forged the seals from the Hollow\'s own ancient Nhalori magic. The seals are the Hollow\'s power, turned against it.',
      villain: 'The Magma Titan',
      open: { who: 'The Magma Titan', text: 'I am your will, Scribe — the part that refused to die. I have burned in this forge since the First Scribe forged the seals from the Hollow King\'s own magic.' },
      bossTaunt: { who: 'The Magma Titan', text: 'The seals are made from Nhalori magic — the Hollow\'s power, turned against it. Break them, and you weaken the prison too.' },
      mid: [
        { who: 'The Last Scribe', text: 'This is the forge where the First Scribe made the seals... from the Hollow\'s own magic. The prison is built from the prisoner\'s power.' },
        { who: 'The Magma Titan', text: 'The seals are the Hollow\'s strength, turned inward. Every shard you reclaim weakens the prison — and the Hollow knows it. It wants you whole.' }
      ],
      intro: [
        { who: 'The Last Scribe', text: 'The Cinder Below is the forge-temple where the First Scribe forged the seals from the Hollow\'s own Nhalori magic — and where the fourth shard, my will, was chained to the Magma Titan.' },
        { who: 'The Last Scribe', text: 'The Titan erupts and reshapes the ground itself, guarding the last shard before the Void.' },
        { who: 'The Last Scribe', text: 'Endure the fire. Reclaim my will — and end what the First Scribe began.' }
      ],
      outro: [
        { who: 'The Last Scribe', text: "The Titan's chains break — and my will returns, unbroken, forged anew. Four shards of five. The prison weakens." },
        { who: 'The Hollow', text: 'You are almost whole, scribe — and my prison is almost broken. The seals were my magic, turned against me. Reclaim the last shard, and the door opens... for both of us.' },
        { who: 'The Last Scribe', text: 'One shard remains — held by the Hollow\'s Echo, a Warden wearing my face.' }
      ]
    },
    {
      id: 5, levelId: 5, name: 'The Neon Void', accent: '#d066ff', icon: '🔮',
      boss: "The Hollow's Echo", power: 'Void · phase & every warden\'s power',
      objective: 'Reclaim the Final Soul-Shard',
      lore: 'The last shard was given to the Hollow\'s Echo — a Warden, not the Hollow itself, wearing every power the Scribe has recovered. The Echo guards the shard to prevent the Scribe from becoming whole and opening the door to the Hollow King.',
      villain: "The Hollow's Echo",
      open: { who: "The Hollow's Echo", text: 'I am the last shard of your soul — and the Hollow\'s first Echo. I guard this shard to keep you from him. The Hollow King wants you whole, scribe. He wants you to inherit his power.' },
      bossTaunt: { who: "The Hollow's Echo", text: 'I am a Warden, not the Hollow. Kill me, and you will be whole — and the door to the King of Nhalori will open. That is what he wants.' },
      mid: [
        { who: 'The Last Scribe', text: 'Every shard I recovered... its power is here. The Echo wears my own soul against me.' },
        { who: "The Hollow's Echo", text: 'Reclaim me, and the Casket of Seals will be whole. Then the souls merge into a doorway — and the Hollow King waits beyond. He wants you to take his power... to become him.' }
      ],
      intro: [
        { who: 'The Last Scribe', text: 'The final realm is a fracture where every memory overlaps. The last shard of my soul waits here.' },
        { who: 'The Last Scribe', text: 'The Hollow\'s Echo is a Warden, not the Hollow — it wears the powers of every shard I have reclaimed.' },
        { who: 'The Last Scribe', text: 'Defeat the Echo. Make my soul whole. Then the Casket will open the door to the Hollow King himself.' }
      ],
      outro: [
        { who: 'The Last Scribe', text: "The Echo falls silent. The last shard joins the rest. My soul is whole." },
        { who: 'The Archivist', text: 'Your soul is complete, Scribe. The Casket of Seals holds all five. Open it — and the souls will merge into a doorway to the Hollow King, the last ruler of Nhalori.' },
        { who: 'The Last Scribe', text: 'I will open the Casket. I will step through. And I will end what the First Scribe began centuries ago.' }
      ]
    }
  ];
  const BY_ID = {}; REALMS.forEach(r => BY_ID[r.id] = r);
  const KEY = 'arena_story_progress';

  function load() {
    const def = { unlocked: [1], completed: [], prologueSeen: false, ending: null };
    try {
      const p = JSON.parse(localStorage.getItem(KEY)) || {};
      return {
        unlocked: Array.isArray(p.unlocked) ? p.unlocked : def.unlocked,
        completed: Array.isArray(p.completed) ? p.completed : def.completed,
        prologueSeen: !!p.prologueSeen,
        ending: p.ending || null
      };
    } catch (e) { return def; }
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function isUnlocked(id) { return load().unlocked.indexOf(id) >= 0; }
  function isCompleted(id) { return load().completed.indexOf(id) >= 0; }
  function markComplete(id) {
    const p = load();
    if (p.completed.indexOf(id) < 0) p.completed.push(id);
    if (id < 5 && p.unlocked.indexOf(id + 1) < 0) p.unlocked.push(id + 1);
    save(p);
  }

  // ---- In-fight Story HUD ------------------------------------------------
  let hudInjected = false, elObj = null, elDlg = null, dlgTimer = 0, midIdx = {};
  function injectHUD() {
    if (hudInjected) return; hudInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      #storyHUD{position:fixed;inset:0;z-index:45;pointer-events:none;display:none;}
      #storyObjective{position:absolute;top:66px;left:50%;transform:translateX(-50%);
        padding:7px 18px;border-radius:999px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;
        font-weight:800;color:#eaf4ff;background:rgba(10,14,22,.78);
        border:1px solid var(--so-accent,#7dffa3);box-shadow:0 0 22px var(--so-accent,#7dffa3);
        white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;}
      #storyObjective .soTag{color:var(--so-accent,#7dffa3);margin-right:8px;}
      #storyDialogue{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);
        width:min(680px,92vw);padding:18px 22px;border-radius:16px;text-align:center;
        background:linear-gradient(180deg,rgba(10,14,22,.92),rgba(6,9,16,.88));
        border:1px solid var(--sd-accent,#7dffa3);box-shadow:0 14px 40px rgba(0,0,0,.6),0 0 30px var(--sd-accent,#7dffa3);
        opacity:0;transition:opacity .35s ease;}
      #storyDialogue.show{opacity:1;}
      #sdWho{font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--sd-accent,#7dffa3);
        text-shadow:0 0 14px var(--sd-accent,#7dffa3);margin-bottom:6px;}
      #sdText{font-size:clamp(16px,2vw,22px);line-height:1.4;color:#eef3ff;text-shadow:0 2px 12px rgba(0,0,0,.9);}
      @keyframes sdIn{from{transform:translate(-50%,-46%);opacity:0}to{transform:translate(-50%,-50%);opacity:1}}`;
    document.head.appendChild(style);
    const hud = document.createElement('div');
    hud.id = 'storyHUD';
    hud.innerHTML = `<div id="storyObjective"><span class="soTag">Objective</span><span id="soText"></span></div>
      <div id="storyDialogue"><div id="sdWho"></div><div id="sdText"></div></div>`;
    document.body.appendChild(hud);
    elObj = document.getElementById('soText');
    elDlg = document.getElementById('storyDialogue');
  }
  function setObjective(realm) {
    if (!realm) { document.getElementById('storyHUD').style.display = 'none'; return; }
    injectHUD();
    document.getElementById('storyHUD').style.display = 'block';
    document.getElementById('storyObjective').style.setProperty('--so-accent', realm.accent);
    elObj.textContent = realm.objective;
  }
  function showDialogue(beat, accent) {
    if (!beat) return;
    injectHUD();
    const hud = document.getElementById('storyHUD');
    hud.style.display = 'block';
    elDlg.style.setProperty('--sd-accent', accent || '#7dffa3');
    document.getElementById('sdWho').textContent = beat.who || '';
    document.getElementById('sdText').textContent = beat.text || '';
    elDlg.classList.add('show');
    clearTimeout(dlgTimer);
    dlgTimer = setTimeout(() => elDlg.classList.remove('show'), 4600);
  }
  function hideHUD() {
    clearTimeout(dlgTimer);
    const hud = document.getElementById('storyHUD');
    if (hud) hud.style.display = 'none';
    if (elDlg) elDlg.classList.remove('show');
  }

  // ---- Story director: reacts to wave starts ----------------------------
  // Wired from pve16.js via window._onStoryWave(n, themeId).
  window._onStoryWave = function (n, themeId) {
    if (!window.STORY_ACTIVE) return;
    const r = BY_ID[window.STORY_REALM] || BY_ID[1];
    if (themeId && themeId !== r.levelId) return;
    setObjective(r);
    if (n === 1) {
      showDialogue(r.open, r.accent);
      midIdx[r.id] = 0;
    } else if (n % 5 === 0) {
      showDialogue(r.bossTaunt, r.accent);
    } else {
      const arr = r.mid || [];
      if (arr.length && midIdx[r.id] < arr.length) {
        showDialogue(arr[midIdx[r.id]++], r.accent);
      }
    }
  };

  // ---- Hub ---------------------------------------------------------------
  let hubInjected = false;
  function injectHub() {
    if (hubInjected) return; hubInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      #overlayStory{position:fixed;inset:0;z-index:50;display:none;place-items:center;
        background:radial-gradient(1200px 600px at 50% -10%,rgba(120,160,255,.10),rgba(4,6,12,.94) 70%);}
      #storyCard{width:min(1040px,95vw);max-height:92vh;overflow:auto;padding:30px 34px 26px;
        background:rgba(10,13,22,.9);border:1px solid rgba(180,220,255,.12);border-radius:22px;
        box-shadow:0 20px 60px rgba(0,0,0,.55);}
      #storyCard h2{text-align:center;letter-spacing:.08em;text-transform:uppercase;font-size:24px;margin:0 0 4px;
        background:linear-gradient(90deg,#fff,#cfe9ff 45%,#ffd7a3 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
        text-shadow:0 0 24px rgba(160,210,255,.25);}
      #storySub{text-align:center;opacity:.82;margin:0 0 18px;font-size:14px;line-height:1.4;color:#cfe1ff;}
      .storyGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
      .storyRealm{position:relative;border-radius:16px;padding:16px;cursor:pointer;overflow:hidden;
        background:linear-gradient(180deg,rgba(20,26,42,.85),rgba(10,14,24,.7));
        border:1px solid var(--sr-accent);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 10px 26px rgba(0,0,0,.4);
        transition:transform .14s ease,box-shadow .14s ease;}
      .storyRealm:hover:not(.locked){transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.55),0 0 26px var(--sr-accent);}
      .storyRealm.locked{cursor:not-allowed;opacity:.5;filter:grayscale(.5);}
      .storyRealm .srGlow{position:absolute;inset:-30%;background:radial-gradient(circle at 50% 0%,var(--sr-accent),transparent 60%);opacity:.18;pointer-events:none;}
      .storyRealm .srIcon{font-size:30px;text-shadow:0 0 18px var(--sr-accent);}
      .storyRealm .srName{font-size:17px;font-weight:800;color:#eaf4ff;margin:8px 0 2px;text-shadow:0 0 12px var(--sr-accent);}
      .storyRealm .srObj{font-size:12px;color:var(--sr-accent);font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
      .storyRealm .srBoss{font-size:13px;color:#cfe1ff;margin-top:4px;}
      .storyRealm .srLore{font-size:13px;line-height:1.4;opacity:.82;margin-top:6px;}
      .storyRealm .srState{margin-top:12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;}
      .storyRealm.locked .srState{color:#9aa3b5;}
      .storyRealm:not(.locked):not(.done) .srState{color:#9fe3ff;}
      .storyRealm.done .srState{color:#7dffa3;}
      #storyEndingBanner{display:none;margin-bottom:14px;padding:10px 16px;border-radius:12px;text-align:center;
        background:linear-gradient(180deg,rgba(40,30,60,.7),rgba(20,16,40,.7));border:1px solid #c066ff;color:#f0e6ff;font-size:14px;}
      #storyBack{margin-top:18px;}
      #overlayStoryEnd{position:fixed;inset:0;z-index:55;display:none;place-items:center;background:rgba(4,5,10,.96);}
      #storyEndCard{width:min(620px,94vw);padding:30px;text-align:center;background:rgba(10,13,22,.92);
        border:1px solid #c066ff;border-radius:20px;box-shadow:0 0 50px rgba(192,102,255,.35);}
      #storyEndCard h2{margin:0 0 8px;letter-spacing:.06em;text-transform:uppercase;font-size:22px;color:#fff;text-shadow:0 0 20px #c066ff;}
      #storyEndTag{opacity:.85;margin:0 0 18px;color:#e6d6ff;font-size:14px;line-height:1.45;}
      .endChoice{display:block;width:100%;margin:10px 0;padding:14px;border-radius:12px;cursor:pointer;
        background:linear-gradient(180deg,rgba(30,24,48,.85),rgba(16,14,30,.85));border:1px solid #c066ff66;color:#eaf4ff;
        font-size:15px;font-weight:700;letter-spacing:.04em;transition:transform .12s ease,box-shadow .12s ease;}
      .endChoice:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(192,102,255,.4);}
      .endChoice .ecSub{display:block;margin-top:4px;font-size:12px;font-weight:500;opacity:.75;letter-spacing:.02em;}
      #overlayCasket{position:fixed;inset:0;z-index:54;display:none;place-items:center;background:rgba(4,5,10,.96);}
      #casketCard{width:min(720px,95vw);max-height:92vh;overflow:auto;padding:30px 34px;text-align:center;
        background:rgba(10,13,22,.92);border:1px solid rgba(208,160,255,.25);border-radius:22px;box-shadow:0 0 60px rgba(180,120,255,.25);}
      #casketCard h2{margin:0 0 4px;letter-spacing:.08em;text-transform:uppercase;font-size:22px;color:#f0e6ff;text-shadow:0 0 22px rgba(200,120,255,.6);}
      #casketCount{margin:0 0 22px;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#c9b6e6;}
      .casketRow{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-bottom:22px;}
      .casketSlot{width:104px;text-align:center;}
      .casketMedallion{width:84px;height:84px;margin:0 auto;border-radius:50%;display:grid;place-items:center;font-size:34px;
        border:2px solid var(--cs-accent,#3a3450);background:radial-gradient(circle at 50% 35%,var(--cs-glow,rgba(255,255,255,.06)),rgba(8,6,16,.9));
        box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 22px var(--cs-glow,transparent);transition:transform .14s ease;}
      .casketSlot.locked .casketMedallion{filter:grayscale(1) brightness(.5);opacity:.45;}
      .casketSlot.unlocked .casketMedallion{animation:csFloat 3s ease-in-out infinite;}
      @keyframes csFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      .casketSlot .csName{margin-top:10px;font-size:12px;font-weight:700;letter-spacing:.04em;}
      .casketSlot.locked .csName{color:#6a6280;}
      .casketSlot.unlocked .csName{color:#e8dcff;text-shadow:0 0 10px var(--cs-glow,transparent);}
      #casketClose{margin-top:8px;}`;
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.id = 'overlayStory';
    ov.className = 'overlay';
    ov.innerHTML = `
      <div id="storyCard">
        <div id="storyEndingBanner"></div>
        <h2>The Last Scribe</h2>
        <p id="storySub">The Hollow King of Nhalori — an ancient tyrant who devoured his own empire for power — was sealed centuries ago by the First Scribe, whose soul was shattered into five shards bound to Wardens. Defeat the Wardens to reclaim that soul. Gather all five shards, open the Casket of Seals, and step through the Soul Doorway to face the Hollow King himself.</p>
        <div class="storyGrid" id="storyGrid"></div>
        <div class="row" style="margin-top:18px;justify-content:center;">
          <button class="btn" id="storyBack">⬅ Back</button>
          <button class="btn" id="storyCasket" title="View the Casket of Seals">🗝️ Casket (0/5)</button>
          <button class="btn" id="storyReset" title="Clear all story progress">🔄 Reset Progress</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('storyBack').addEventListener('click', () => {
      window.MENU_CONTEXT = 'intro';
      document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
      const intro = document.getElementById('overlayIntro');
      if (intro) intro.style.display = 'grid';
    });
    document.getElementById('storyReset').addEventListener('click', () => {
      if (confirm('Reset ALL story progress? Every realm will be locked again and the prologue will replay.')) {
        try { localStorage.removeItem(KEY); } catch (e) {}
        buildHub();
      }
    });


    const end = document.createElement('div');
    end.id = 'overlayStoryEnd';
    end.innerHTML = `
      <div id="storyEndCard">
        <h2>The Soul Doorway</h2>
        <p id="storyEndTag">Your soul is whole. The five shards merge into a doorway of light. Beyond it, the Hollow King's Wardens await — reborn, all at once — and the King of Nhalori looms above them. Will you step through?</p>
        <button class="endChoice" data-end="through">Step Through the Doorway<span class="ecSub">Face all five Wardens at once, then the Hollow itself.</span></button>
        <button class="endChoice" data-end="wait">Not Yet<span class="ecSub">Return to the hub. The doorway will wait.</span></button>
      </div>`;
    document.body.appendChild(end);
    end.querySelectorAll('.endChoice').forEach(btn => {
      btn.addEventListener('click', () => onEndingChoice(btn.dataset.end));
    });

    // Fate choice overlay (after the Hollow falls): restore / break / take
    const fate = document.createElement('div');
    fate.id = 'overlayStoryFate';
    fate.className = 'overlay';
    fate.innerHTML = `
      <div id="storyEndCard">
        <h2>The Hollow Falls</h2>
        <p id="storyEndTag">The Hollow King of Nhalori falls. His ancient power waits for your hand. What will you make of it?</p>
        <button class="endChoice" data-fate="restore">Restore the Seals<span class="ecSub">Forge the chains of Nhalori anew. Become the Hollow King's warden, forever.</span></button>
        <button class="endChoice" data-fate="break">Break the Seals<span class="ecSub">End the Hollow King. The ancient magic sleeps. You are only yourself.</span></button>
        <button class="endChoice" data-fate="take">Take the Power<span class="ecSub">Claim the fragments. Become the new Hollow King.</span></button>
      </div>`;
    document.body.appendChild(fate);
    fate.querySelectorAll('.endChoice').forEach(btn => {
      btn.addEventListener('click', () => onFateChoice(btn.dataset.fate));
    });

    // Casket of Seals overlay
    const cask = document.createElement('div');
    cask.id = 'overlayCasket';
    cask.className = 'overlay';
    cask.innerHTML = `
      <div id="casketCard">
        <h2>🗝️ The Casket of Seals</h2>
        <p id="casketCount">0 / 5 seals unlocked</p>
        <div class="casketRow" id="casketRow"></div>
        <div class="row" style="justify-content:center;">
          <button class="btn" id="casketClose">Close</button>
        </div>
      </div>`;
    document.body.appendChild(cask);
    document.getElementById('casketClose').addEventListener('click', () => { cask.style.display = 'none'; });
    document.getElementById('storyCasket').addEventListener('click', () => {
      const p = load();
      if (p.completed.length >= 5) {
        // The Casket-opening cinematic is a React + three.js scene hosted by the
        // parent document (src/components/casketCutscene). Ask the parent to play
        // it; it posts 'casket-cutscene-done' back when the finale completes, and
        // the handler below shows the Soul Doorway choice.
        if (window.parent && window.parent !== window) {
          try { window.parent.postMessage({ type: 'casket-cutscene-start' }, '*'); } catch (e) { showEndingChoice(); }
        } else {
          showEndingChoice();
        }
      } else {
        openCasket(cask);
      }
    });

    // Parent (React shell) signals the Casket cinematic has finished → show the
    // Soul Doorway ending choice, exactly as the old in-iframe UltimateCutscene did.
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (d && d.type === 'casket-cutscene-done') {
        try { showEndingChoice(); } catch (err) {}
      }
    });
  }

  function openCasket(cask) {
    const p = load();
    const row = document.getElementById('casketRow');
    row.innerHTML = '';
    REALMS.forEach(r => {
      const unlocked = p.completed.indexOf(r.id) >= 0;
      const slot = document.createElement('div');
      slot.className = 'casketSlot ' + (unlocked ? 'unlocked' : 'locked');
      slot.style.setProperty('--cs-accent', r.accent);
      slot.style.setProperty('--cs-glow', unlocked ? r.accent : 'transparent');
      slot.innerHTML = '<div class="casketMedallion">' + (unlocked ? r.icon : '🔒') + '</div><div class="csName">' + (unlocked ? r.name : 'Sealed') + '</div>';
      row.appendChild(slot);
    });
    document.getElementById('casketCount').textContent = p.completed.length + ' / 5 seals unlocked';
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    cask.style.display = 'grid';
  }

  const END_LINES = {
    restore: [
      { who: 'The Last Scribe', text: 'I forge the seals anew — from the same ancient magic that made the Hollow. The chains of Nhalori bind it once more.' },
      { who: 'The Hollow', text: 'You cage me again, scribe. But the magic is mine. The seals are mine. You will guard my prison... forever.' },
      { who: 'The Archivist', text: 'You chose the cage, Scribe. The world endures. But you are bound to the Hollow now — its warden, and its prisoner.' }
    ],
    break: [
      { who: 'The Last Scribe', text: 'I break the seals. The ancient magic unravels — and the Hollow, the last echo of Nhalori, dissolves into the dark.' },
      { who: 'The Hollow', text: 'So... I finally end. An age of hunger, finished by a scribe who remembers nothing. Perhaps... that is mercy.' },
      { who: 'The Last Scribe', text: 'The glyphs fade from my skin. The magic of Nhalori sleeps at last. I am only a scribe. I am only myself.' }
    ],
    take: [
      { who: 'The Last Scribe', text: 'I take the fragments. The power of Nhalori floods through me — the hunger, the ambition, the will to outlast everything.' },
      { who: 'The Hollow', text: 'Yes. You understand now. Empires fall. Scribes die. But power endures. Welcome, new Hollow King.' },
      { who: 'The Last Scribe', text: 'The seals bend to my hand. The Wardens kneel. Somewhere, a child is learning to read glyphs... and I am waiting.' }
    ]
  };

  const SOUL_DOOR = [
    { who: 'The Last Scribe', text: 'I step through the doorway. The five Wardens rise at once — my own soul, twisted by centuries of the Hollow\'s ancient hunger.' },
    { who: 'The Hollow', text: 'Welcome to my gauntlet, whole one. Five Wardens. Ten stages. Slay them all — then face the King of Nhalori. Or die, and begin again at my door.' }
  ];

  function onEndingChoice(which) {
    const end = document.getElementById('overlayStoryEnd');
    if (end) end.style.display = 'none';
    if (which === 'through') {
      if (window.SoulDoorway) SoulDoorway.play({ onDone: function () { if (window.HollowGauntlet) window.HollowGauntlet.start(); else showHub(); } });
      else StoryCutscene.play(SOUL_DOOR, { accent: '#d066ff', icon: '🔮', onDone: function () { if (window.HollowGauntlet) window.HollowGauntlet.start(); else showHub(); } });
    } else {
      showHub();
    }
  }

  // ---- Fate choice (shown after The Hollow is defeated) ----
  function showFateChoice() {
    injectHub();
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    const fate = document.getElementById('overlayStoryFate');
    if (fate) fate.style.display = 'grid';
  }
  function onFateChoice(key) {
    const fate = document.getElementById('overlayStoryFate');
    if (fate) fate.style.display = 'none';
    const p = load(); p.ending = key; save(p);
    var onDone = function () {
      if (window.HollowGauntlet && window.HollowGauntlet.finishEnding) window.HollowGauntlet.finishEnding();
      else { if (window._hardStopGame) window._hardStopGame(); showHub(); }
    };
    if (key === 'restore' && window.EndingRestore) EndingRestore.play({ onDone: onDone });
    else if (key === 'break' && window.EndingBreak) EndingBreak.play({ onDone: onDone });
    else if (key === 'take' && window.EndingTake) EndingTake.play({ onDone: onDone });
    else StoryCutscene.play(END_LINES[key] || [], { accent: '#c066ff', icon: '🔮', onDone: onDone });
  }

  function buildHub() {
    injectHub();
    const grid = document.getElementById('storyGrid');
    if (!grid) return;
    grid.innerHTML = '';
    REALMS.forEach(r => {
      const unlocked = isUnlocked(r.id);
      const done = isCompleted(r.id);
      const card = document.createElement('div');
      card.className = 'storyRealm' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
      card.style.setProperty('--sr-accent', r.accent);
      const stateText = done ? '✓ Fragment recovered' : unlocked ? '▸ Begin Chapter' : '🔒 Sealed';
      card.innerHTML = `
        <div class="srGlow"></div>
        <div class="srIcon">${unlocked ? r.icon : '🔒'}</div>
        <div class="srName">${unlocked ? r.name : '??? Realm ' + r.id}</div>
        <div class="srObj">${unlocked ? 'Objective · ' + r.objective : 'Unknown objective'}</div>
        <div class="srBoss">${unlocked ? 'Warden: ' + r.boss : 'Unknown Warden'}</div>
        <div class="srLore">${unlocked ? r.lore : 'Break the previous realm\'s seal to reveal this chapter.'}</div>
        <div class="srState">${stateText}</div>`;
      if (unlocked && !done) card.addEventListener('click', () => startRealm(r.id));
      grid.appendChild(card);
    });
    const banner = document.getElementById('storyEndingBanner');
    const p = load();
    if (p.ending) {
      const label = p.ending === 'restore' ? 'Restored the Seals' : p.ending === 'break' ? 'Broke the Seals' : 'Took the Hollow\'s Power';
      banner.style.display = 'block';
      banner.textContent = '★ Campaign complete — you chose to ' + label + '. Replay any chapter below.';
    } else if (p.completed.length === 5) {
      banner.style.display = 'block';
      banner.textContent = '★ All five soul-shards recovered — open the Casket of Seals to face the Hollow.';
    } else {
      banner.style.display = 'none';
    }
    const caskBtn = document.getElementById('storyCasket');
    if (caskBtn) {
      const done = p.completed.length;
      caskBtn.textContent = done >= 5 ? '🗝️ Open the Casket ▸' : '🗝️ Casket (' + done + '/5)';
    }
  }

  function showHub() {
    hideHUD();
    buildHub();
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    const ov = document.getElementById('overlayStory');
    if (ov) ov.style.display = 'grid';
  }

  function startRealm(id) {
    const r = BY_ID[id]; if (!r) return;
    window.STORY_REALM = id;
    if (id === 1) {
      // The Hearth Warden intro is a high-fidelity React + three.js cinematic
      // hosted by the parent document (it overlays the iframe). Ask the parent
      // to play it; it posts 'hearth-warden-intro-done' back when finished.
      // Mute the iframe's own music while the parent cutscene plays.
      if (window.parent && window.parent !== window) {
        window._EXTERNAL_CUTSCENE = true;
        const finishIntro = () => { window._EXTERNAL_CUTSCENE = false; launchArena(id); };
        const handler = (e) => {
          if (e && e.data && e.data.type === 'hearth-warden-intro-done') {
            window.removeEventListener('message', handler);
            finishIntro();
          }
        };
        window.addEventListener('message', handler);
        try {
          window.parent.postMessage({ type: 'hearth-warden-intro-start', realm: id }, '*');
        } catch (e2) {
          window.removeEventListener('message', handler);
          window._EXTERNAL_CUTSCENE = false;
          if (window.MeadowCutscene) MeadowCutscene.play(r.intro, { onDone: () => launchArena(id) });
          else launchArena(id);
        }
      } else if (window.MeadowCutscene) {
        MeadowCutscene.play(r.intro, { onDone: () => launchArena(id) });
      } else {
        StoryCutscene.play(r.intro, { accent: r.accent, icon: r.icon, onDone: () => launchArena(id) });
      }
    } else if (id === 2 && window.DunesCutscene) {
      DunesCutscene.play(r.intro, { onDone: () => launchArena(id) });
    } else if (id === 3 && window.GlacialCutscene) {
      GlacialCutscene.play(r.intro, { onDone: () => launchArena(id) });
    } else if (id === 4 && window.CinderCutscene) {
      CinderCutscene.play(r.intro, { onDone: () => launchArena(id) });
    } else {
      StoryCutscene.play(r.intro, { accent: r.accent, icon: r.icon, onDone: () => launchArena(id) });
    }
  }

  function launchArena(id) {
    const r = BY_ID[id]; if (!r) return;
    window.STORY_ACTIVE = true;
    window.STORY_REALM = id;
    window.MENU_CONTEXT = 'single';
    window.BOTS_ENABLED = false;
    window.PVP_MODE = false;
    // Guard against a second launch arriving (message + direct call).
    if (window._STORY_LAUNCH_T) return;
    window._STORY_LAUNCH_T = setTimeout(() => { window._STORY_LAUNCH_T = 0; }, 2500);
    window._EXTERNAL_CUTSCENE = false;
    try { localStorage.setItem('arenaLevel', String(id)); localStorage.setItem('level', String(id)); } catch (e) {}
    // Hide every menu overlay (story hub included) so the arena is visible.
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    // Start the run straight through the engine: set the realm theme, then run
    // the normal match reset. This skips the level-select card / countdown /
    // lobby path, which can stall and leave the player on a dead screen after
    // the intro cinematic.
    if (window._Gauntlet && window._Gauntlet.setThemeById && window._Gauntlet.restart) {
      try {
        window._Gauntlet.setThemeById(id);
        window._Gauntlet.restart();
        return;
      } catch (e) { /* fall through to the menu path below */ }
    }
    const card = document.querySelector('#levelsGrid [data-level="' + id + '"]');
    if (card) { card.click(); }
    else { document.getElementById('btnRestart')?.click(); }
  }

  // Engine hook: wave‑5 boss death (wired in pve16.js).
  window._onStoryBossDefeated = function (realmId) {
    if (!window.STORY_ACTIVE) return;
    window.STORY_ACTIVE = false;
    hideHUD();
    const r = BY_ID[realmId] || BY_ID[1];
    markComplete(realmId);
    try { if (window.RS) RS.awardWarden(); } catch (e) {}
    try { document.getElementById('btnHome')?.click(); } catch (e) {}
    setTimeout(() => {
      document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
      const isLast = realmId === 5;
      const num = ['first', 'second', 'third', 'fourth', 'final'][realmId - 1] || 'next';
      // Boss death cinematic: draw the real boss sprite shattering, map-themed.
      const bossMod = realmId === 1 ? window.HearthWarden : realmId === 2 ? window.PharaohGlass : realmId === 3 ? window.RimeOracle : realmId === 4 ? window.MagmaTitan : null;
      const themeKey = realmId === 1 ? 'meadow' : realmId === 2 ? 'dunes' : realmId === 3 ? 'glacial' : realmId === 4 ? 'cinder' : 'meadow';
      const sprite = bossMod && bossMod.sprite ? bossMod.sprite : null;
      const accent = (bossMod && bossMod.ACCENT) || r.accent;
      const glyph = (bossMod && bossMod.GLYPH) || r.accent;
      const playFragmentAndOutro = () => {
        document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
        FragmentScene.play({
      accent: r.accent, icon: r.icon, theme: ({ 1: 'meadow', 2: 'dunes', 3: 'glacial', 4: 'cinder', 5: 'void' })[realmId] || 'meadow',
      who: 'The Last Scribe',
      line: 'The ' + num + ' fragment settles into my palm — a piece of the Hollow, recovered.',
      onDone: () => {
      document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
      const OUTRO_FOR = {
        1: window.MeadowOutroCutscene, 2: window.DunesOutroCutscene,
        3: window.GlacialOutroCutscene, 4: window.CinderOutroCutscene,
        5: window.VoidOutroCutscene
      };
      const outroMod = OUTRO_FOR[realmId];
      const playOutro = outroMod
        ? (beats, opts) => outroMod.play(beats, opts)
        : (beats, opts) => StoryCutscene.play(beats, opts);
      playOutro(r.outro, { accent: r.accent, icon: r.icon, onDone: showHub });
      }
        });
      };
      if (sprite && window.BossDeathScene) {
        BossDeathScene.play({ sprite, accent, glyph, theme: themeKey, name: r.boss, onDone: playFragmentAndOutro });
      } else {
        playFragmentAndOutro();
      }
    }, 80);
  };

  function showEndingChoice() {
    injectHub();
    document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
    const end = document.getElementById('overlayStoryEnd');
    if (end) end.style.display = 'grid';
  }

  // Prologue: plays once the first time the hub opens.
  function maybePlayPrologue(onDone) {
    const p = load();
    if (p.prologueSeen) { onDone(); return; }
    p.prologueSeen = true; save(p);
    StoryCutscene.play(PROLOGUE, { accent: '#c066ff', icon: '🔮', onDone: onDone });
  }

  function init() {
    injectHub();
    const b = document.getElementById('introStory');
    if (b) b.addEventListener('click', () => maybePlayPrologue(showHub));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Called directly by the React host when its cutscene overlay closes, so the
  // match starts even if the postMessage hand-off is missed.
  function resumeRealm(id) {
    launchArena(id || window.STORY_REALM || 1);
  }

  window.Story = { startRealm, showHub, buildHub, isUnlocked, isCompleted, REALMS, showEndingChoice, showFateChoice, resumeRealm };
})();
