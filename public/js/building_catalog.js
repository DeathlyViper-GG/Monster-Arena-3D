// ============================================================
// Monster Arena — Themed Buildings & Codex
// Per-level building archetypes, weighted probabilistic spawns,
// themed chests, an in-menu discovery codex, and a themed
// top-down renderer. Hooks into the engine via window._onWorldBuilt,
// window._onChestOpen, window.drawThemedBuilding, window.buildBuildingCatalogUI.
// ============================================================
(function(){
  const LEVEL_META=[
    {id:1,name:'Meadow',accent:'#7dffa3'},
    {id:2,name:'Desert',accent:'#ffd166'},
    {id:3,name:'Ice Cavern',accent:'#9fe3ff'},
    {id:4,name:'Lava Pits',accent:'#ff7a66'},
    {id:5,name:'Neon Void',accent:'#d066ff'},
  ];

  // spawn = per-eligible-building probability this archetype appears (rarity scale).
  // The MOST common archetype on a level still only has a 50% spawn chance; the
  // rarest drop to ~5%. weight picks WHICH archetype a building rolls for; spawn
  // then decides whether it actually becomes themed (so most buildings stay normal).
  // guardian = sentry that orbits the building and unleashes a themed power.
  const ARCHETYPES=[
    // Meadow
    {id:'cottage',name:'Watchtower Cottage',level:1,shape:'cottage',accent:'#7dffa3',icon:'🏡',weight:30,spawn:0.50,
     chest:{name:'Cottage Cache',accent:'#9ffb9f'},blurb:'A snug stone cottage with a peaked roof and a glowing hearth.',
     guardian:{name:'Hearth Warden',power:'heal',col:'#7dffa3',hp:140,dmg:10,speed:1.0}},
    {id:'barn',name:'Timber Barn',level:1,shape:'barn',accent:'#a4d574',icon:'🏚️',weight:24,spawn:0.35,
     chest:{name:'Barn Hoard',accent:'#bfe98a'},blurb:'A wide timber barn storing forgotten supplies.',
     guardian:{name:'Hay Golem',power:'slow',col:'#a4d574',hp:200,dmg:12,speed:0.7}},
    {id:'hut',name:'Hunter Hut',level:1,shape:'hut',accent:'#5fae6a',icon:'🏠',weight:18,spawn:0.20,
     chest:{name:'Hunter Stash',accent:'#7dffa3'},blurb:"A hunter's shelter tucked in the tall grass.",
     guardian:{name:'Huntress Shade',power:'pierce',col:'#5fae6a',hp:120,dmg:16,speed:1.2}},
    // Desert
    {id:'pyramid',name:'Desert Pyramid',level:2,shape:'pyramid',accent:'#ffd166',icon:'🔺',weight:10,spawn:0.05,
     chest:{name:'Pharaoh Hoard',accent:'#ffd166'},blurb:'A stepped sandstone pyramid hiding royal loot.',
     guardian:{name:'Pharaoh Mummy',power:'sand',col:'#ffd166',hp:300,dmg:18,speed:0.8}},
    {id:'temple',name:'Sun Temple',level:2,shape:'temple',accent:'#ffb347',icon:'🏛️',weight:20,spawn:0.30,
     chest:{name:'Sun Reliquary',accent:'#ffd166'},blurb:'A columned temple raised to the desert sun.',
     guardian:{name:'Sun Priest',power:'sunbolt',col:'#ffb347',hp:160,dmg:14,speed:1.0}},
    {id:'tent',name:'Nomad Tent',level:2,shape:'tent',accent:'#e0a85a',icon:'⛺',weight:30,spawn:0.50,
     chest:{name:'Caravan Chest',accent:'#ffd166'},blurb:"A nomad's sun-bleached tent.",
     guardian:{name:'Dune Rider',power:'dart',col:'#e0a85a',hp:110,dmg:12,speed:1.3}},
    {id:'ruin_d',name:'Sandstone Ruin',level:2,shape:'ruin',accent:'#caa05a',icon:'🪨',weight:22,spawn:0.30,
     chest:{name:'Buried Relic',accent:'#ffd166'},blurb:'Crumbling sandstone walls half-swallowed by dunes.',
     guardian:{name:'Bone Revenant',power:'summon',col:'#caa05a',hp:180,dmg:10,speed:0.9}},
    // Ice
    {id:'igloo',name:'Ice Igloo',level:3,shape:'igloo',accent:'#9fe3ff',icon:'🛖',weight:30,spawn:0.50,
     chest:{name:'Frozen Cache',accent:'#9fe3ff'},blurb:'A dome carved from a single glacier.',
     guardian:{name:'Frost Sprite',power:'freeze',col:'#9fe3ff',hp:120,dmg:12,speed:1.1}},
    {id:'vault_i',name:'Glacial Vault',level:3,shape:'vault_i',accent:'#bfe9ff',icon:'❄️',weight:16,spawn:0.12,
     chest:{name:'Frost Vault',accent:'#9fe3ff'},blurb:'A sealed vault of eternal frost.',
     guardian:{name:'Glacier Knight',power:'iceshards',col:'#bfe9ff',hp:240,dmg:16,speed:0.8}},
    {id:'shrine_i',name:'Frost Shrine',level:3,shape:'shrine_i',accent:'#7fd0ff',icon:'⛩️',weight:22,spawn:0.30,
     chest:{name:'Rime Reliquary',accent:'#9fe3ff'},blurb:'A shrine to the winter spirits.',
     guardian:{name:'Rime Oracle',power:'freeze',col:'#7fd0ff',hp:150,dmg:14,speed:1.0}},
    // Lava
    {id:'forge',name:'Lava Forge',level:4,shape:'forge',accent:'#ff7a66',icon:'🔥',weight:30,spawn:0.50,
     chest:{name:'Forge Cache',accent:'#ff7a66'},blurb:"A blacksmith's forge glowing with embers.",
     guardian:{name:'Forge Smith',power:'firebolt',col:'#ff7a66',hp:150,dmg:16,speed:1.0}},
    {id:'bastion',name:'Obsidian Bastion',level:4,shape:'bastion',accent:'#ff5a44',icon:'🌋',weight:14,spawn:0.10,
     chest:{name:'Magma Hoard',accent:'#ff7a66'},blurb:'A fortress of black obsidian.',
     guardian:{name:'Magma Titan',power:'erupt',col:'#ff5a44',hp:320,dmg:22,speed:0.7}},
    {id:'chapel',name:'Cinder Chapel',level:4,shape:'chapel',accent:'#ffa080',icon:'⛪',weight:22,spawn:0.30,
     chest:{name:'Cinder Reliquary',accent:'#ff7a66'},blurb:'A chapel scorched by the pits.',
     guardian:{name:'Cinder Priest',power:'firebolt',col:'#ffa080',hp:160,dmg:14,speed:1.0}},
    // Void
    {id:'shrine_v',name:'Neon Shrine',level:5,shape:'shrine_v',accent:'#d066ff',icon:'💠',weight:30,spawn:0.50,
     chest:{name:'Phase Cache',accent:'#d066ff'},blurb:'A shrine pulsing with void energy.',
     guardian:{name:'Void Cultist',power:'phase',col:'#d066ff',hp:140,dmg:14,speed:1.1}},
    {id:'obelisk',name:'Void Obelisk',level:5,shape:'obelisk',accent:'#b85cff',icon:'🗼',weight:12,spawn:0.08,
     chest:{name:'Obelisk Core',accent:'#d066ff'},blurb:'A tall obelisk humming with phase matter.',
     guardian:{name:'Phase Sentinel',power:'phase',col:'#b85cff',hp:220,dmg:18,speed:0.9}},
    {id:'sanctum',name:'Phase Sanctum',level:5,shape:'sanctum',accent:'#c066ff',icon:'🔮',weight:18,spawn:0.20,
     chest:{name:'Void Reliquary',accent:'#d066ff'},blurb:'A sanctum folded outside normal space.',
     guardian:{name:'Sanctum Mind',power:'phase',col:'#c066ff',hp:260,dmg:18,speed:0.9}},
  ];

  const ARCHETYPE_BY_ID={};for(const a of ARCHETYPES)ARCHETYPE_BY_ID[a.id]=a;
  const BY_LEVEL={};for(const a of ARCHETYPES)(BY_LEVEL[a.level]=BY_LEVEL[a.level]||[]).push(a);

  // Discovery persistence
  const DISC_KEY='arena_discovered_buildings';
  function loadDisc(){try{return JSON.parse(localStorage.getItem(DISC_KEY)||'[]');}catch(e){return[];}}
  function saveDisc(arr){try{localStorage.setItem(DISC_KEY,JSON.stringify(arr));}catch(e){}}
  function recordDisc(id){const a=loadDisc();if(a.indexOf(id)<0){a.push(id);saveDisc(a);}}
  window.isBuildingDiscovered=function(id){return loadDisc().indexOf(id)>=0;};
  // Returns a building's themed archetype ONLY if it was flagged as a landmark
  // by _onWorldBuilt. Normal buildings return null and render with the standard
  // building look — so the themed ones actually stand out.
  window.getBuildingType=function(b,lvl){ return (b&&b._type)||null; };

  // Deterministic per-building type selection (stable across re-themes/polls)
  function hashB(x,y){let h=((x|0)*73856093)^((y|0)*19349663);h=(h^(h>>>13))>>>0;return (h%1000)/1000;}
  function hashI(x,y){let h=((x|0)*73856093)^((y|0)*19349663);h=(h^(h>>>13))>>>0;return h>>>0;}
  function pickType(lvl,b){
    const list=BY_LEVEL[lvl]||BY_LEVEL[1];
    const total=list.reduce((s,a)=>s+(a.weight||1),0);
    let r=hashB(b.x,b.y)*total,acc=0;
    for(const a of list){acc+=(a.weight||1);if(r<acc)return a;}
    return list[0];
  }
  // second stable hash 0..1, independent of pickType's hash
  function hashB2(x,y){let h=((x|0)*2246822519)^((y|0)*3266489917);h=(h^(h>>>16))>>>0;h=Math.imul(h,2246822519)>>>0;return (h%100000)/100000;}

  // Returns the guardian spec (or null) for a themed building id — used by the
  // game loop to spawn sentries that orbit and defend each landmark.
  window.getBuildingGuardian=function(b){
    if(!b||!b._type) return null; const t=b._type; const g=t.guardian;
    if(!g) return null;
    // rarity tier 1..4 derived from the archetype's spawn chance (rarest => scariest).
    const rarity = t.rarity || (t.spawn>=0.45?1:t.spawn>=0.25?2:t.spawn>=0.12?3:4);
    return Object.assign({},g,{id:t.id,rarity,level:t.level});
  };

  // Engine hook: roll EACH chest-bearing building independently. The rolled
  // archetype's `spawn` probability decides whether it actually becomes a
  // themed landmark (most common = 50%, rarest = 5%). Buildings that fail the
  // roll stay normal, so themed ones are genuinely rare and the rarest
  // archetypes almost never show up. Deterministic per map layout.
  window._onWorldBuilt=function(world,theme){
    if(!world||!world.buildings){return;}
    // Teams mode: no themed landmarks or their special chests — leave every
    // building plain so the arena is just geometry + titans/golems.
    if(window.TEAMS_MODE){ for(const b of world.buildings){ b._type=null; b.typeId=null; b._lvl=(theme?theme.id:1); b._guardianSpawned=true; } return; }
    const lvl=theme?theme.id:1;
    for(const b of world.buildings){ b._type=null; b.typeId=null; b._lvl=lvl; b._guardianSpawned=false; }
    let themed=0;
    for(const b of world.buildings){
      if(!b.hasChest && hashB2(b.x,b.y) > 0.25) continue; // chest buildings + a few others are eligible
      const t=pickType(lvl,b);
      const roll=hashB2(b.x+131,b.y+977);
      if(roll < (t.spawn||0.5)){
        b._type=t; b.typeId=t.id; themed++;
      }
      if(themed>=3) break; // cap themed landmarks at 3 per map
    }
    if(world.chests){
      for(const ch of world.chests){
        const b=world.buildings[ch.buildingIndex];
        if(!b||!b._type)continue;
        ch.typeId=b._type.id;ch.typeLabel=b._type.chest.name;ch.glow=b._type.chest.accent;
      }
    }
  };

  // Engine hook: record discovery on chest open
  window._onChestOpen=function(ch){if(ch&&ch.typeId)recordDisc(ch.typeId);};

  // Local rounded-rect helper (engine's roundRect is not global)
  function R(ctx,X,Y,W,H,r){const rr=Math.max(0,Math.min(r,Math.min(W,H)/2));ctx.beginPath();ctx.moveTo(X+rr,Y);ctx.arcTo(X+W,Y,X+W,Y+H,rr);ctx.arcTo(X+W,Y+H,X,Y+H,rr);ctx.arcTo(X,Y+H,X,Y,rr);ctx.arcTo(X,Y,X+W,Y,rr);ctx.closePath();}

  // Themed top-down building renderer — MAXIMUM CONTRAST vs normal buildings.
  // Landmarks use fully-saturated archetype-colour walls, thick neon glowing
  // borders, strong pulsing auras, and a huge glowing rune so they're
  // unmissable against the drab stone normal buildings.
  window.drawThemedBuilding=function(ctx,b,x,y,theme){
    const t=b.t,w=b.w,h=b.h;
    const tp=b._type||ARCHETYPE_BY_ID[b.typeId];
    if(!tp)return;
    const acc=tp.accent;
    const ix=x+t,iy=y+t,iw=w-2*t,ih=h-2*t;
    const now=performance.now()/1000;
    const pulse=0.5+0.5*Math.sin(now*2.2);
    ctx.save();

    // 1. BIG pulsing neon aura halo (screen blend) — the #1 "this is special" cue
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=0.35+0.25*pulse;
    ctx.fillStyle=acc;
    ctx.filter='blur(10px)';
    ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2+22,h/2+22,0,0,Math.PI*2);ctx.fill();
    ctx.filter='none';
    ctx.restore();

    // 2. ground shadow
    ctx.fillStyle='rgba(0,0,0,0.40)';
    ctx.beginPath();ctx.ellipse(x+w/2+6,y+h/2+10,w/2+5,h/2+3,0,0,Math.PI*2);ctx.fill();

    // 3. FULLY SATURATED archetype-coloured wall (not a faint tint)
    ctx.fillStyle=acc;
    R(ctx,x,y,w,h,10);ctx.fill();
    // darken slightly so the neon border + interior pop
    ctx.save();R(ctx,x,y,w,h,10);ctx.clip();
    const darken=ctx.createLinearGradient(x,y,x+w,y+h);
    darken.addColorStop(0,'rgba(0,0,0,0.0)');
    darken.addColorStop(1,'rgba(0,0,0,0.35)');
    ctx.fillStyle=darken;ctx.fillRect(x,y,w,h);
    ctx.restore();

    // 4. THICK neon glowing border — drawn twice for a double-glow effect
    ctx.save();
    ctx.strokeStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=28;ctx.lineWidth=5;
    ctx.globalAlpha=0.9+0.1*pulse;
    R(ctx,x,y,w,h,10);ctx.stroke();
    ctx.shadowBlur=14;ctx.lineWidth=2;ctx.strokeStyle='#ffffff';
    ctx.globalAlpha=0.85;
    R(ctx,x,y,w,h,10);ctx.stroke();
    ctx.restore();

    // 5. bright glowing roof band along the TOP edge (archetype colour, full sat)
    const bandH=Math.min(22,h*0.3);
    ctx.save();
    ctx.fillStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=18;
    R(ctx,x,y,w,bandH,6);ctx.fill();
    // white hot core line
    ctx.fillStyle='rgba(255,255,255,0.6)';ctx.shadowBlur=8;
    ctx.fillRect(x+4,y+bandH-3,w-8,2);
    ctx.restore();

    // 6. themed interior — dark recess with bright archetype accents
    if(iw>0&&ih>0){
      ctx.save();R(ctx,ix,iy,iw,ih,8);ctx.clip();
      const s=tp.shape;
      // dark interior base so the neon details glow
      ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(ix,iy,iw,ih);

      if(s==='pyramid'){
        const tiers=4;
        for(let i=0;i<tiers;i++){const f=i/(tiers-1),pw=iw*(1-f*0.55),ph=ih*(1-f*0.55);
          ctx.fillStyle=i%2?acc:'#000';
          ctx.globalAlpha=i%2?(0.5+0.2*pulse):0.35;
          R(ctx,ix+iw*f*0.55*0.5,iy+ih*f*0.55*0.5,pw,ph,5);ctx.fill();}
        ctx.globalAlpha=1;
        ctx.fillStyle='#fff';ctx.shadowColor=acc;ctx.shadowBlur=20;
        ctx.beginPath();ctx.arc(ix+iw/2,iy+ih/2,9+pulse*3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }else if(s==='temple'||s==='chapel'){
        const cols=Math.max(3,Math.floor(iw/30));
        ctx.fillStyle='rgba(255,255,255,0.85)';ctx.shadowColor=acc;ctx.shadowBlur=10;
        for(let c=0;c<cols;c++){const cx=ix+iw*(c+0.5)/cols;ctx.fillRect(cx-4,iy+2,8,ih-4);}
        ctx.shadowBlur=0;
        ctx.fillStyle=acc;ctx.globalAlpha=0.4+0.3*pulse;
        ctx.fillRect(ix+iw*0.25,iy+ih*0.25,iw*0.5,ih*0.5);ctx.globalAlpha=1;
      }else if(s==='tent'){
        const cx=ix+iw/2;
        ctx.fillStyle='rgba(255,255,255,0.55)';
        ctx.beginPath();ctx.moveTo(ix,iy+ih);ctx.lineTo(cx,iy+2);ctx.lineTo(ix+iw,iy+ih);ctx.closePath();ctx.fill();
        ctx.strokeStyle=acc;ctx.lineWidth=3;ctx.shadowColor=acc;ctx.shadowBlur=12;
        ctx.beginPath();ctx.moveTo(cx,iy+2);ctx.lineTo(cx,iy+ih);ctx.stroke();ctx.shadowBlur=0;
        ctx.fillStyle=acc;ctx.beginPath();ctx.arc(cx,iy+2,5,0,Math.PI*2);ctx.fill();
      }else if(s==='igloo'){
        const cx=ix+iw/2,cy=iy+ih*0.6,rr=Math.min(iw,ih)*0.42;
        ctx.fillStyle='rgba(207,235,255,0.7)';
        ctx.beginPath();ctx.arc(cx,cy,rr,Math.PI,0);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(cx,cy,rr,Math.PI,0);ctx.stroke();
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(cx-10,cy-2,20,ih*0.42);
        ctx.fillStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=10;
        ctx.fillRect(cx-3,cy,6,ih*0.4);ctx.shadowBlur=0;
      }else if(s==='vault'||s==='bastion'||s==='sanctum'){
        ctx.strokeStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=16;ctx.lineWidth=3;
        ctx.globalAlpha=0.6+0.3*pulse;
        ctx.strokeRect(ix+4,iy+4,iw-8,ih-8);ctx.globalAlpha=1;ctx.shadowBlur=0;
        ctx.lineWidth=2;ctx.globalAlpha=0.5;
        ctx.beginPath();ctx.moveTo(ix,iy);ctx.lineTo(ix+iw,iy+ih);ctx.moveTo(ix+iw,iy);ctx.lineTo(ix,iy+ih);ctx.stroke();ctx.globalAlpha=1;
        ctx.fillStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=14;
        ctx.beginPath();ctx.arc(ix+iw/2,iy+ih/2,5+pulse*2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }else if(s==='forge'){
        const hx=ix+iw/2,hy=iy+ih/2,hr=Math.min(iw,ih)*0.3;
        const g=ctx.createRadialGradient(hx,hy,2,hx,hy,hr);
        g.addColorStop(0,'#fff');g.addColorStop(0.3,acc);g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g;ctx.globalAlpha=0.7+0.25*Math.sin(now*4);
        ctx.beginPath();ctx.arc(hx,hy,hr,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
        ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(ix+iw-14,iy+3,11,16);
      }else if(s==='shrine'){
        ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(ix+iw*0.15,iy+ih*0.55,iw*0.7,ih*0.3);
        const cx=ix+iw/2,cy=iy+ih*0.4,rr=Math.min(iw,ih)*0.2;
        ctx.strokeStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=14;ctx.lineWidth=3;
        ctx.globalAlpha=0.8+0.2*pulse;
        ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(cx,cy,rr*0.55,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=1;ctx.shadowBlur=0;
        ctx.fillStyle=acc;ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
      }else if(s==='obelisk'){
        const ow=Math.min(iw,ih)*0.36,ox=ix+iw/2-ow/2,oy=iy+ih*0.5-ow*1.1;
        ctx.fillStyle=acc;ctx.globalAlpha=0.5;
        R(ctx,ox,oy,ow,ow*2.2,4);ctx.fill();ctx.globalAlpha=1;
        ctx.strokeStyle='#fff';ctx.shadowColor=acc;ctx.shadowBlur=14;ctx.lineWidth=2.5;
        R(ctx,ox,oy,ow,ow*2.2,4);ctx.stroke();ctx.shadowBlur=0;
        ctx.fillStyle='#fff';ctx.shadowColor=acc;ctx.shadowBlur=18;
        ctx.beginPath();ctx.arc(ix+iw/2,oy-3,5+pulse*2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }else if(s==='ruin'){
        ctx.fillStyle='rgba(255,255,255,0.7)';ctx.shadowColor=acc;ctx.shadowBlur=8;
        ctx.fillRect(ix,iy,iw*0.4,8);ctx.fillRect(ix+iw*0.6,iy,8,ih*0.5);ctx.fillRect(ix,iy+ih*0.7,iw*0.3,8);
        ctx.shadowBlur=0;
        ctx.fillStyle=acc;ctx.globalAlpha=0.5+0.3*pulse;
        ctx.fillRect(ix+iw*0.4,iy+ih*0.4,iw*0.2,ih*0.2);ctx.globalAlpha=1;
      }else{ // cottage / barn
        ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=3;
        ctx.beginPath();if(iw>=ih){ctx.moveTo(ix,iy+ih/2);ctx.lineTo(ix+iw,iy+ih/2);}else{ctx.moveTo(ix+iw/2,iy);ctx.lineTo(ix+iw/2,iy+ih);}ctx.stroke();
        if(s==='barn'){ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.beginPath();if(iw>=ih){ctx.moveTo(ix+iw/2,iy);ctx.lineTo(ix+iw/2,iy+ih);}else{ctx.moveTo(ix,iy+ih/2);ctx.lineTo(ix+iw,iy+ih/2);}ctx.stroke();}
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(ix+(iw>=ih?iw-16:iw*0.4),iy+4,12,16);
        ctx.fillStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=12;
        ctx.fillRect(ix+(iw>=ih?iw-14:iw*0.42),iy+2,8,6);ctx.shadowBlur=0;
      }
      ctx.restore();
    }

    // 7. doors — glowing archetype-coloured frame
    for(const d of b.doors){
      const dx=d.x-(b.x-x),dy=d.y-(b.y-y);
      ctx.save();
      ctx.fillStyle=acc;ctx.shadowColor=acc;ctx.shadowBlur=10;
      R(ctx,dx-3,dy-3,d.w+6,d.h+6,4);ctx.fill();ctx.shadowBlur=0;
      const dg=ctx.createLinearGradient(dx,dy,dx+d.w,dy+d.h);dg.addColorStop(0,'#000');dg.addColorStop(1,'#1a0a1a');ctx.fillStyle=dg;R(ctx,dx,dy,d.w,d.h,3);ctx.fill();
      ctx.restore();
    }

    // 8. HUGE glowing rune emblem in the centre — the defining landmark marker
    ctx.save();
    ctx.globalAlpha=0.95;
    ctx.fillStyle='#fff';ctx.shadowColor=acc;ctx.shadowBlur=24;
    ctx.font='bold '+Math.round(Math.min(w,h)*0.46)+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(tp.icon||'✦',x+w/2,y+h/2);
    // second pass for extra glow
    ctx.shadowBlur=12;ctx.globalAlpha=0.6;
    ctx.fillText(tp.icon||'✦',x+w/2,y+h/2);
    ctx.restore();

    ctx.restore();
  };

  // Codex UI builder
  window.buildBuildingCatalogUI=function(){
    const root=document.getElementById('buildingCatalog');if(!root)return;
    const disc=new Set(loadDisc());
    let html='';
    for(let lvl=1;lvl<=5;lvl++){
      const meta=LEVEL_META[lvl-1];
      const list=BY_LEVEL[lvl]||[];
      html+=`<div class="codexLvl" style="color:${meta.accent};text-shadow:0 0 8px ${meta.accent}66">${lvl}. ${meta.name}</div>`;
      for(const a of list){
        const found=disc.has(a.id);
        html+=`<div class="codexCard${found?'':' locked'}" style="--cx-accent:${a.accent}">
          <div class="cxIcon">${found?a.icon:'❓'}</div>
          <div class="cxName">${found?a.name:'???'}</div>
          <div class="cxLvl">${meta.name}${found?'':' · Undiscovered'}</div>
          <div class="cxDesc">${found?a.blurb:'Open its themed chest to discover this structure.'}</div>
          <div class="cxChest">${found?'💎 '+a.chest.name:''}</div>
        </div>`;
      }
    }
    root.innerHTML=html;
  };
})();
