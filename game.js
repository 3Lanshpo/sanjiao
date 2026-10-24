// =====================================================================
//  小丑魔战斗 网页版 —— 由 C++/Win32 版完整移植
//  HTML5 Canvas + Web Audio，支持手机触屏操作
// =====================================================================
'use strict';

// ---------------- 常量 ----------------
const WINW = 640, WINH = 480;
const BOX_X0 = 120, BOX_Y0 = 278, BOX_X1 = 520, BOX_Y1 = 418;
const BOX_CX = (BOX_X0 + BOX_X1) * 0.5, BOX_CY = (BOX_Y0 + BOX_Y1) * 0.5;
const JEV_CX = 320, JEV_CY = 140;
const HEART_SPD = 185.0;
const TOUCH_SPD = 300.0;          // 触屏跟手速度（略高于键盘，弥补触控延迟）
const PLAYER_MAXHP = 120.0;

// 状态
const ST_TITLE=0, ST_PAUSE=1, ST_INTRO=2, ST_MENU=3, ST_SUB=4,
      ST_FIGHT=5, ST_DMG=6, ST_DIALOG=7, ST_ATTACK=8, ST_WIN=9, ST_LOSE=10;
const SM_NONE=0, SM_ACT=1, SM_ITEM=2, SM_MERCY=3;

// 招式
const P_CAROUSEL=0, P_RAIN=1, P_KNIVES=2, P_SPIRAL=3,
      P_DEAL=4, P_MAIL=5, P_CALL=6, P_KROMER=7,
      P_CRUSHER=8, P_CHAIN=9, P_BOMB=10, P_LASER=11,
      P_MAGIC=12, P_LOVE=13, P_MEOW=14, P_GHOST=15;
// 子弹类型
const B_SPADE=0, B_DIAMOND=1, B_CLUB=2, B_KNIFE=3,
      B_PHONE=4, B_COIN=5, B_MAIL=6,
      B_HEART=7, B_BOMB=8,
      B_STAR=9, B_PAW=10, B_GHOST=11,
      B_CATBOMB=12, B_WHITECAT=13, B_CROSS=14, B_COUNT=15;

// ---------------- 工具 ----------------
let _seed = (Date.now() % 2147483647) | 0;
function rnd(a, b) {          // 与 C++ 版同分布 [a,b]
  _seed = (_seed * 48271) % 2147483647;
  return a + (b - a) * ((_seed % 10001) / 10000);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 < 1e-4) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// ---------------- Boss 数据 ----------------
const BOSSES = [
{ name:"小丑魔", title:"JEVIL　·　混沌的弄臣", bgm:"bgm_jevil.mp3",
  maxhp:900, warn:1.25, dur:10.0,
  pat:[P_CAROUSEL,P_RAIN,P_KNIVES,P_SPIRAL], patW:1.0,
  line:["混沌！混沌！哈哈哈哈哈！","我是谁？你是谁？我可以做任何事！",
        "转呀转，车轮转呀转！","跑呀跑呀跑！你能跟上我吗？","小丑在镜中笑，你抓不到我～"],
  patLine:["跑马灯！转呀转呀转！","方块雨！哗啦啦啦啦！","看刀！飞呀飞呀飞！","梅花喷泉！转圈圈！"],
  actNeed:4, check:"小丑魔  攻击90  防御10  混沌无极限！" },
{ name:"Tenna", title:"TENNA　·　电视节目主持人", bgm:"bgm_tenna.mp3",
  maxhp:1150, warn:1.05, dur:11.5,
  pat:[P_DEAL,P_MAIL,P_CALL,P_KROMER], patW:1.12,
  line:["欢迎来到[大奖赛]！各位观众！","[收视率]就是我的生命！",
        "别换台！好戏才刚开始！","[独家直播]！只要你的灵魂！","别想逃！镜头已经锁定你了！"],
  patLine:["成交！只要 1997 KROMER！","[邮件]来了！全是你一个人的！","电话响啦！快接快接！","[KROMER] 围过来了！"],
  actNeed:5, check:"Tenna  攻击78  防御6  全城收视冠军" },
{ name:"大人物", title:"BIG SHOT　·　SPAMTON NEO", bgm:"bgm_spamton.mp3",
  maxhp:1500, warn:0.90, dur:13.0,
  pat:[P_CRUSHER,P_CHAIN,P_BOMB,P_LASER], patW:1.25,
  line:["现在！你的机会来了！成为 [大人物]！","我有 [弦]！我牵动一切！",
        "被操纵的 [心脏] 在跳动！","[自由]？那是 [无价] 的！","不要看我的 [引线]！"],
  patLine:["[压缩墙]！找缝隙！","[锁链之心] 缠住你！","[炸弹]！十字爆炸！","[热线]！别碰光束！"],
  actNeed:6, check:"大人物  攻击99  防御20  不再被任何人牵线" },
{ name:"Pink", title:"MAD MEW MEW　·　粉色魔法少女", bgm:"bgm_pink.mp3",
  maxhp:1900, warn:0.75, dur:14.5,
  pat:[P_MAGIC,P_LOVE,P_MEOW,P_GHOST], patW:1.40,
  line:["喵～人家一直想见你哦！","可爱就是正义！喵！",
        "这个身体……完美吧？喵哈哈！","不许躲开人家的爱！","再来一次！Cutie Revolution！"],
  patLine:["白猫冲锋！找空隙！喵！","喵喵炸弹！十字光波！","猫爪连击！喵喵喵！","幽灵分身！穿墙来啦！"],
  actNeed:7, check:"Pink  攻击110  防御24  粉色魔法少女，无敌可爱" },
];
const BOSS_N = 4;
const Boss = () => BOSSES[g_boss];

// ---------------- 全局状态 ----------------
let g_state=ST_TITLE, g_sub=SM_NONE, g_pattern=P_CAROUSEL, g_lastPat=P_SPIRAL;
let g_stateT=0, g_subSel=0, g_btnSel=0, g_boss=0, g_bossSel=0;
let g_vol=70, g_pauseFrom=ST_MENU, g_pauseSel=0;
let g_hp=PLAYER_MAXHP, g_items=3, g_pacify=0, g_turn=0;
let g_jevHp=900, g_jevHpShown=false, g_spareReady=false;
let g_heartX=BOX_CX, g_heartY=BOX_CY, g_inv=0;
let g_jevShake=0, g_jevOffX=0, g_jevOffY=0, g_tpTimer=0;
let g_barX=0, g_barHit=false, g_pendingDmg=0;
let g_hitFlash=0, g_redFlash=0;
let g_subtitle="";
let g_bullets=[], g_dmg=[], g_sparks=[];
let g_spawnT=0, g_knifeWarn=-1, g_warnY=0, g_warnX=0, g_warnSide=0;
let g_waveN=0, g_fired=false, g_afterDialog=ST_MENU;
let g_animT=0;
let g_loveN=0, g_spiralA=0;                    // C++ static 变量

// 特效
let g_shakeT=0, g_shakeMag=0, g_hitStop=0, g_whiteFlash=0;
let g_parts=[], g_rings=[];
function AddShake(t,m){ g_shakeT=Math.max(g_shakeT,t); g_shakeMag=Math.max(g_shakeMag,m); }
function AddHitStop(t){ g_hitStop=Math.max(g_hitStop,t); }
function SpawnPart(x,y,vx,vy,life,size,r,g,b,grav){
  if (g_parts.length>400) return;
  g_parts.push({x,y,vx,vy,life,maxlife:life,size,r,g,b,grav:!!grav});
}
function BurstParts(x,y,n,spd,r,g,b,life=0.5,grav=false){
  for (let i=0;i<n;i++){
    const a=rnd(0,6.2832), s=rnd(spd*0.3,spd);
    SpawnPart(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(life*0.5,life),rnd(3,7),r,g,b,grav);
  }
}
function AddRing(x,y,maxR,r,g,b){ g_rings.push({x,y,t:0,maxR,r,g,b}); }

// 线上分享链接用 ?sharecode=xxx 鉴权：所有子资源都必须带上同一查询串
const QS = location.search || "";
const ASSET = (name) => "assets/" + name + QS;

// ---------------- 素材加载 ----------------
const IMG = {};
const IMG_LIST = ["bg","jevil","soul","spade","diamond","club","knife","boom","sparkle",
  "btn_fight","btn_act","btn_item","btn_mercy","phone","mine","paw","coin","mail",
  "heart","bomb","star","ghost","catbomb","whitecat","jevil_spared","jevil_tired",
  "mad_mew_mew","spamton_neo"];
for (let i=0;i<8;i++){ IMG_LIST.push("jevil_jump_"+i); IMG_LIST.push("jevil_hurt_"+i); }
for (let i=0;i<8;i++){ IMG_LIST.push("tenna_"+i); IMG_LIST.push("neo_"+i); IMG_LIST.push("pink_"+i); }
for (let i=0;i<4;i++){ IMG_LIST.push("spamton_"+i); }

const SFX = {};
const SFX_LIST = ["snd_menu_move","snd_menu_select","snd_slash"];
let loadTotal = IMG_LIST.length + SFX_LIST.length, loadDone = 0;
let loadFinishCb = null;

function onLoadOne(){
  loadDone++;
  const p = Math.round(loadDone/loadTotal*100);
  const f = document.getElementById("lfill"), t = document.getElementById("lpct");
  if (f) f.style.width = p+"%";
  if (t) t.textContent = p+"%";
  if (loadDone >= loadTotal && loadFinishCb) { loadFinishCb(); loadFinishCb = null; }
}
for (const n of IMG_LIST){
  const im = new Image();
  im.onload = onLoadOne; im.onerror = onLoadOne;
  im.src = ASSET(n+".png");
  IMG[n] = im;
}
for (const n of SFX_LIST){
  const a = new Audio(ASSET(n+".wav"));
  a.addEventListener("canplaythrough", onLoadOne, {once:true});
  a.addEventListener("error", onLoadOne, {once:true});
  a.load();
  SFX[n] = a;
}
function playSfx(n){
  try { const a = SFX[n]; if (!a) return;
    const b = a.cloneNode(); b.volume = 0.9; b.play().catch(()=>{}); } catch(e){}
}

// BGM
const bgm = new Audio();
bgm.loop = true; bgm.preload = "auto";
let bgmName = "";
function BgmStart(file){
  const src = ASSET(file);
  if (bgmName === src && !bgm.paused) return;
  bgmName = src; bgm.src = src; bgm.volume = g_vol/100;
  bgm.play().catch(()=>{});
}
function BgmStop(){ bgm.pause(); bgmName=""; }

// ---------------- 帧动画 ----------------
function jevilJumpN(){ let n=0; for (let i=0;i<8;i++) if (IMG["jevil_jump_"+i] && IMG["jevil_jump_"+i].naturalWidth) n++; return n; }
function BossFrame(idx, fast){
  const spd = fast ? 16 : 7;
  const f = Math.floor(g_animT*spd);
  if (idx===0){ const n=jevilJumpN(); return n>0 ? IMG["jevil_jump_"+(f%n)] : IMG.jevil; }
  const names = ["","tenna_","neo_","pink_"];
  const arr = ["","tenna","neo","pink"][idx];
  let n=0; const list=[];
  for (let i=0;i<8;i++){ const im=IMG[arr+"_"+i]; if (im && im.naturalWidth){ n++; list.push(im);} }
  if (n>0) return list[f%n];
  return [IMG.jevil, IMG["tenna_0"]||IMG["spamton_0"], IMG["neo_0"]||IMG.spamton_neo, IMG["pink_0"]||IMG.mad_mew_mew][idx];
}
function frameCount(prefix, max){
  let n=0; for (let i=0;i<max;i++){ const im=IMG[prefix+i]; if (im && im.naturalWidth) n++; } return n;
}

// ---------------- 流程 ----------------
function Say(s){ g_subtitle = s; }

function ResetGame(){
  const B = Boss();
  g_hp=PLAYER_MAXHP; g_items=3; g_pacify=0; g_turn=0;
  g_jevHp=B.maxhp; g_jevHpShown=false; g_spareReady=false;
  g_state=ST_INTRO; g_stateT=0; g_sub=SM_NONE; g_btnSel=0;
  g_bullets=[]; g_dmg=[]; g_sparks=[];
  g_heartX=BOX_CX; g_heartY=BOX_CY; g_inv=0;
  g_jevOffX=0; g_jevOffY=0; g_tpTimer=0;
  g_hitFlash=0; g_redFlash=0; g_lastPat=B.pat[0];
  g_whiteFlash=0.45;
  AddRing(JEV_CX,JEV_CY,120,255,230,150);
  AddRing(JEV_CX,JEV_CY,70,255,255,220);
  BurstParts(JEV_CX,JEV_CY,18,180,255,240,190,0.7);
  AddShake(0.3,4);
  Say(`${B.name} 拦住了你的去路！`);
  crtDirty = true;
  BgmStop(); BgmStart(B.bgm);
}
function GoTitle(){
  g_state=ST_TITLE; g_stateT=0;
  g_bullets=[]; g_dmg=[]; g_sparks=[];
  Say(""); BgmStop();
}
function StartBattle(boss){ g_boss=boss; ResetGame(); }
function StartDialog(s, after){ Say(s); g_afterDialog=after; g_state=ST_DIALOG; g_stateT=0; }

// ---------------- 弹幕 ----------------
function SpawnBulletAt(t,x,y,vx,vy,r){
  g_bullets.push({type:t, ring:false, x,y,vx,vy, r,
    rot:0, rotv:(t===B_KNIFE||t===B_PHONE||t===B_PAW)?0:rnd(-3,3),
    ang:0, rx:0, ry:0, w:0, cx:0, cy:0,
    phase:rnd(0,6.28), life:0, dmg:12});
}
function FirePattern(){
  const ramp = 1.0 + Math.min(1.0, g_turn*0.10);
  const pw = Boss().patW;
  if (g_pattern===P_CAROUSEL){
    const rxs=[58,96,128,150], rys=[24,42,54,63];
    for (let ring=0; ring<4; ++ring){
      const n = 5+ring;
      for (let i=0;i<n;++i){
        let w = (ring%2 ? -1.15 : 1.35)*(1.0+ring*0.20)*ramp;
        g_bullets.push({type:B_SPADE, ring:true,
          rx:rxs[ring], ry:rys[ring],
          ang:i*(6.2832/n)+ring*0.4,
          w:w*pw, rotv:w*2.4*pw, rot:0, r:13, phase:ring*1.7,
          cx:BOX_CX, cy:BOX_CY, x:BOX_CX, y:BOX_CY, dmg:12, life:0, vx:0, vy:0});
      }
    }
  } else if (g_pattern===P_CHAIN){
    for (let ring=0; ring<2; ++ring){
      const n = 4+ring*2;
      for (let i=0;i<n;++i){
        const w = (ring ? -1.8 : 2.3)*ramp*pw;
        g_bullets.push({type:B_HEART, ring:true,
          rx:54+ring*52, ry:26+ring*26,
          ang:i*(6.2832/n)+ring*0.6,
          w, rotv:w*2.0, rot:0, r:12, phase:ring*1.3,
          cx:BOX_CX, cy:BOX_CY, x:BOX_CX, y:BOX_CY, dmg:14, life:0, vx:0, vy:0});
      }
    }
  }
  for (let i=0;i<6;++i)
    g_sparks.push({x:BOX_CX+rnd(-70,70), y:BOX_CY+rnd(-45,45), t:0, scale:rnd(0.9,1.4)});
}
function SpawnPattern(){
  const B = Boss();
  g_pattern = B.pat[randInt(4)];
  if (g_pattern===g_lastPat) g_pattern = B.pat[randInt(3)];
  g_lastPat = g_pattern;
  g_bullets=[];
  g_spawnT=0.2; g_knifeWarn=-1; g_fired=false; g_waveN=0;
  g_heartX=BOX_CX; g_heartY=BOX_CY;
  for (let i=0;i<4;i++) if (B.pat[i]===g_pattern){ Say(B.patLine[i]); break; }
  if (g_boss===0) playVoice(randInt(2)===0 ? "Jevil_voiceclip_CHAOS.wav" : "Jevil_voiceclip_ANYTHING.wav");
  g_state=ST_ATTACK; g_stateT=0;
}
function randInt(n){ _seed=(_seed*48271)%2147483647; return _seed%n; }
function rndf(a,b){ return rnd(a,b); }

function playVoice(file){
  try { const a = new Audio(ASSET(file)); a.volume=0.9; a.play().catch(()=>{}); } catch(e){}
}

// ---------------- 命中 ----------------
function HitPlayer(dmg){
  if (g_inv>0) return;
  g_hp-=dmg; g_inv=1.0; g_redFlash=0.35;
  AddShake(0.25,5);
  BurstParts(g_heartX,g_heartY,10,130,255,80,110,0.5);
  for (let i=0;i<3;++i)
    g_sparks.push({x:g_heartX+rnd(-10,10), y:g_heartY+rnd(-10,10), t:0, scale:rnd(0.6,1.1)});
  if (g_hp<=0){
    g_hp=0; g_state=ST_LOSE; g_stateT=0;
    AddShake(0.5,8);
    BurstParts(g_heartX,g_heartY,24,200,255,70,100,0.8);
    Say("你被混沌吞没了……");
  }
}
function HitJevil(dmg){
  g_jevHp-=dmg; g_jevShake=0.5; g_jevHpShown=true; g_hitFlash=0.25;
  AddHitStop(0.09+0.06*Math.min(1,dmg/60));
  AddShake(0.18,3+dmg*0.06);
  BurstParts(JEV_CX+rnd(-20,20),JEV_CY+rnd(-20,10),12,150,255,240,160,0.5);
  g_dmg.push({x:JEV_CX+rnd(-30,30), y:JEV_CY-40, vy:-55, life:1.0, val:dmg, miss:false});
  g_sparks.push({x:JEV_CX+rnd(-40,40), y:JEV_CY+rnd(-30,30), t:0, scale:1.6});
  if (g_jevHp<=0){
    g_jevHp=0;
    AddHitStop(0.28); AddShake(0.6,9); g_whiteFlash=0.35;
    AddRing(JEV_CX,JEV_CY,150,255,240,160);
    for (let i=0;i<8;++i)
      g_sparks.push({x:JEV_CX+rnd(-70,70), y:JEV_CY+rnd(-80,80), t:0, scale:rnd(1.2,2.2)});
    BurstParts(JEV_CX,JEV_CY,30,260,255,250,200,0.9);
    g_state=ST_WIN; g_stateT=0;
    Say(`${Boss().name} 倒下了……`);
  }
}
function DoPlayerAction(){
  const B = Boss();
  if (g_sub===SM_ACT){
    if (g_subSel===0){ StartDialog(B.check, ST_MENU); }
    else {
      g_pacify++;
      if (g_pacify>=B.actNeed){
        g_spareReady=true;
        StartDialog(`${B.name} 累了……可以饶恕了！（MERCY）`, ST_MENU);
      } else {
        StartDialog(`你安抚了${B.name}……（${g_pacify}/${B.actNeed}）`, ST_MENU);
      }
      g_sparks.push({x:JEV_CX+rnd(-40,40), y:JEV_CY+rnd(-40,40), t:0, scale:1.2});
    }
  } else if (g_sub===SM_ITEM){
    if (g_items>0){
      g_items--; g_hp=Math.min(PLAYER_MAXHP, g_hp+60);
      g_dmg.push({x:JEV_CX, y:JEV_CY-60, vy:-40, life:0.8, val:60, miss:false});
      StartDialog("你吃掉了魔法软糖，回复了 60 HP！", ST_MENU);
    } else StartDialog("软糖吃光了……", ST_MENU);
  } else if (g_sub===SM_MERCY){
    if (g_subSel===0){
      if (g_spareReady){
        for (let i=0;i<10;++i)
          g_sparks.push({x:JEV_CX+rnd(-80,80), y:JEV_CY+rnd(-90,90), t:0, scale:rnd(1.0,2.0)});
        g_state=ST_WIN; g_stateT=0;
        Say(`${B.name} 安静下来，睡了一个好觉……`);
      } else {
        StartDialog(`${B.name} 还没平息，无法饶恕！（多试试 ACT 安抚）`, ST_MENU);
      }
    } else StartDialog("走不掉的……战斗还没有结束！", ST_MENU);
  }
  g_sub=SM_NONE;
}

// ---------------- 更新 ----------------
function Update(dt){
  if (g_hitStop>0){ g_hitStop-=dt; dt*=0.15; }
  g_animT += dt;
  if (g_inv>0) g_inv-=dt;
  if (g_hitFlash>0) g_hitFlash-=dt;
  if (g_redFlash>0) g_redFlash-=dt;
  if (g_jevShake>0) g_jevShake-=dt;
  if (g_shakeT>0){ g_shakeT-=dt; if (g_shakeT<=0) g_shakeMag=0; }
  if (g_whiteFlash>0) g_whiteFlash-=dt;

  // 粒子
  for (const p of g_parts){
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if (p.grav) p.vy+=260*dt;
    p.vx*=(1-1.6*dt); p.vy*=(1-1.6*dt);
  }
  g_parts = g_parts.filter(p=>p.life>0);
  for (const r of g_rings) r.t+=dt;
  g_rings = g_rings.filter(r=>r.t<=0.45);
  for (const d of g_dmg){ d.y+=d.vy*dt; d.vy*=0.94; d.life-=dt; }
  for (const s of g_sparks) s.t+=dt;
  g_dmg = g_dmg.filter(d=>d.life>0);
  g_sparks = g_sparks.filter(s=>s.t<=0.55);

  switch (g_state){
  case ST_INTRO:
    g_stateT+=dt;
    if (g_stateT>1.6) StartDialog(Boss().line[randInt(5)], ST_MENU);
    break;
  case ST_DIALOG:
    g_stateT+=dt;
    if (g_stateT>2.0){
      const nx=g_afterDialog; g_afterDialog=ST_MENU;
      if (nx===ST_MENU){ g_state=ST_MENU; g_stateT=0; Say(""); }
      else if (nx===ST_ATTACK) SpawnPattern();
    }
    break;
  case ST_FIGHT:
    g_stateT+=dt;
    g_barX+=520*dt;
    if (g_barX>392){
      g_pendingDmg=0;
      g_dmg.push({x:JEV_CX, y:JEV_CY-50, vy:-50, life:1.0, val:0, miss:true});
      g_state=ST_DMG; g_stateT=0;
    }
    break;
  case ST_DMG:
    g_stateT+=dt;
    if (g_stateT>0.9){
      if (g_jevHp<=0) break;
      StartDialog(Boss().line[randInt(5)], ST_ATTACK);
    }
    break;
  case ST_TITLE:
    g_stateT+=dt;
    break;
  case ST_PAUSE:
    break;                       // 完全冻结（与 C++ 版一致：暂停不推进计时）
  case ST_ATTACK: {
    const B = Boss();
    g_stateT+=dt;
    const ramp = (1.0+Math.min(1.0,g_turn*0.10))*B.patW;

    // 红心移动（键盘）
    let sp = HEART_SPD*dt;
    if (keys.has("ArrowLeft"))  g_heartX-=sp;
    if (keys.has("ArrowRight")) g_heartX+=sp;
    if (keys.has("ArrowUp"))    g_heartY-=sp;
    if (keys.has("ArrowDown"))  g_heartY+=sp;
    // 触屏：红心追手指
    if (touchTarget){
      const dx=touchTarget.x-g_heartX, dy=touchTarget.y-g_heartY;
      const d=Math.hypot(dx,dy);
      if (d>2){
        const step=Math.min(d, TOUCH_SPD*dt);
        g_heartX+=dx/d*step; g_heartY+=dy/d*step;
      }
    }
    g_heartX=clamp(g_heartX, BOX_X0+10, BOX_X1-10);
    g_heartY=clamp(g_heartY, BOX_Y0+10, BOX_Y1-10);

    // boss 瞬移
    g_tpTimer-=dt;
    if (g_tpTimer<=0){
      g_tpTimer=rnd(0.8,1.4);
      g_sparks.push({x:g_jevOffX+JEV_CX, y:g_jevOffY+JEV_CY, t:0, scale:1.4});
      g_jevOffX=rnd(-60,60); g_jevOffY=rnd(-25,25);
      g_sparks.push({x:g_jevOffX+JEV_CX, y:g_jevOffY+JEV_CY, t:0, scale:1.4});
    }

    // 预警→开火
    const firing = g_stateT>=B.warn;
    if (firing && !g_fired){ g_fired=true; FirePattern(); }

    if (firing){
      g_spawnT-=dt;
      // ---- 小丑魔：方块雨
      if (g_pattern===P_RAIN && g_spawnT<=0){
        g_spawnT=0.30/ramp;
        SpawnBulletAt(B_DIAMOND, rnd(BOX_X0+20,BOX_X1-20), BOX_Y0-20, 0, rnd(150,205)*ramp, 12);
        if (g_turn>=3)
          SpawnBulletAt(B_DIAMOND, rnd(BOX_X0+20,BOX_X1-20), BOX_Y0-30, 0, rnd(150,205)*ramp, 12);
      }
      // ---- 梅花喷泉
      if (g_pattern===P_SPIRAL && g_spawnT<=0){
        g_spawnT=0.16/ramp;
        g_spiralA+=0.86;
        for (let k=0;k<2;++k){
          const aa=g_spiralA+k*3.1416;
          SpawnBulletAt(B_CLUB, BOX_CX, BOX_CY, Math.cos(aa)*165*ramp, Math.sin(aa)*165*ramp, 12);
        }
      }
      // ---- 镰刀扫射
      if (g_pattern===P_KNIVES){
        if (g_knifeWarn<0 && g_spawnT<=0){
          g_knifeWarn=0.35; g_warnSide=randInt(4);
          if (g_warnSide<=1){ g_warnY=g_heartY; g_warnX=0; }
          else              { g_warnX=g_heartX; g_warnY=0; }
        }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            const spd=470*ramp;
            let ang=0,x=0,y=0,vx=0,vy=0;
            if (g_warnSide===0)     { x=BOX_X0-30; y=g_warnY; vx=spd; ang=0; }
            else if (g_warnSide===1){ x=BOX_X1+30; y=g_warnY; vx=-spd; ang=3.1416; }
            else if (g_warnSide===2){ x=g_warnX; y=BOX_Y0-30; vy=spd; ang=1.5708; }
            else                    { x=g_warnX; y=BOX_Y1+30; vy=-spd; ang=-1.5708; }
            SpawnBulletAt(B_KNIFE,x,y,vx,vy,14);
            g_bullets[g_bullets.length-1].rot=ang;
            g_spawnT=0.26/ramp;
          }
        }
      }
      // ---- Tenna：成交
      if (g_pattern===P_DEAL && g_spawnT<=0){
        g_spawnT=0.42/ramp;
        const t = (randInt(3)!==0) ? B_COIN : B_PHONE;
        SpawnBulletAt(t, BOX_X1+24, rnd(BOX_Y0+16,BOX_Y1-16), -rnd(240,300)*ramp, 0, 12);
      }
      // ---- Tenna：邮件
      if (g_pattern===P_MAIL && g_spawnT<=0){
        g_spawnT=0.20/ramp;
        SpawnBulletAt(B_MAIL, rnd(BOX_X0+14,BOX_X1-14), BOX_Y0-18, rnd(-100,100), rnd(195,255)*ramp, 12);
        if (g_turn>=3)
          SpawnBulletAt(B_MAIL, rnd(BOX_X0+14,BOX_X1-14), BOX_Y0-34, rnd(-100,100), rnd(195,255)*ramp, 12);
      }
      // ---- Tenna：来电
      if (g_pattern===P_CALL){
        if (g_knifeWarn<0 && g_spawnT<=0){ g_knifeWarn=0.5; g_warnX=g_heartX; }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            for (let i=0;i<4;++i)
              SpawnBulletAt(B_PHONE, g_warnX, BOX_Y0-26-i*52, 0, 255*ramp, 14);
            g_spawnT=1.25/ramp;
          }
        }
      }
      // ---- Tenna：KROMER 包围
      if (g_pattern===P_KROMER && g_spawnT<=0){
        g_spawnT=2.2/ramp;
        const n=12, gap0=randInt(n);
        for (let i=0;i<n;++i){
          const di=(i-gap0+n)%n;
          if (di<3) continue;
          const a=i*6.2832/n;
          const x=BOX_CX+Math.cos(a)*190, y=BOX_CY+Math.sin(a)*85;
          const spd=150*ramp;
          SpawnBulletAt(B_COIN, x, y, -Math.cos(a)*spd, -Math.sin(a)*spd*0.6, 11);
        }
      }
      // ---- NEO：压缩墙
      if (g_pattern===P_CRUSHER){
        if (g_knifeWarn<0 && g_spawnT<=0){ g_knifeWarn=0.6; g_warnY=g_heartY; }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            const ys=[BOX_Y0+16,BOX_Y0+44,BOX_CY,BOX_Y1-44,BOX_Y1-16];
            let gap=2;
            for (let i=0;i<5;++i) if (Math.abs(ys[i]-g_warnY)<34) gap=i;
            for (let i=0;i<5;++i){
              if (i===gap || (i+1)%5===gap) continue;
              SpawnBulletAt(B_PHONE, BOX_X0-26, ys[i],  165*ramp, 0, 15);
              SpawnBulletAt(B_PHONE, BOX_X1+26, ys[i], -165*ramp, 0, 15);
            }
            AddShake(0.3,4);
            for (let i=0;i<10;++i)
              SpawnPart(rnd(BOX_X0,BOX_X0+30), rnd(BOX_Y0,BOX_Y1), rnd(20,80), rnd(-20,20), rnd(0.3,0.6), rnd(3,6), 200,190,220);
            for (let i=0;i<10;++i)
              SpawnPart(rnd(BOX_X1-30,BOX_X1), rnd(BOX_Y0,BOX_Y1), rnd(-80,-20), rnd(-20,20), rnd(0.3,0.6), rnd(3,6), 200,190,220);
            g_spawnT=2.6/ramp;
          }
        }
      }
      // ---- NEO：炸弹
      if (g_pattern===P_BOMB && g_spawnT<=0){
        g_spawnT=1.15/ramp;
        const bx=rnd(BOX_X0+26,BOX_X1-26), by=rnd(BOX_Y0+22,BOX_Y1-22);
        SpawnBulletAt(B_BOMB,bx,by,0,0,13);
        const b=g_bullets[g_bullets.length-1];
        b.life=1.0; b.rotv=6.0; b.dmg=8;
        BurstParts(bx,by,4,40,255,200,120,0.4);
      }
      // ---- NEO：热线激光
      if (g_pattern===P_LASER){
        if (g_knifeWarn<0 && g_spawnT<=0){
          g_knifeWarn=0.55; g_warnSide=randInt(2);
          if (g_warnSide===0) g_warnY=rnd(BOX_Y0+24,BOX_Y1-24);
          else                g_warnX=rnd(BOX_X0+24,BOX_X1-24);
        }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            g_bullets.push({type:B_PHONE, ring:false, vx:0, vy:0, rot:0, rotv:0,
              rx:(g_warnSide===0)?1:0, r:6, life:0.85, dmg:18, phase:0,
              x:(g_warnSide===0)?BOX_CX:g_warnX, y:(g_warnSide===0)?g_warnY:BOX_CY,
              ang:0, ry:0, w:0, cx:0, cy:0});
            if (g_warnSide===0){
              for (let i=0;i<14;++i)
                SpawnPart(rnd(BOX_X0,BOX_X1), g_warnY+rnd(-6,6), rnd(-40,40), rnd(-120,-40), rnd(0.3,0.6), rnd(3,6), 255,120,90);
              AddRing(BOX_CX,g_warnY,60,255,120,140);
            } else {
              for (let i=0;i<14;++i)
                SpawnPart(g_warnX+rnd(-6,6), rnd(BOX_Y0,BOX_Y1), rnd(-120,-40), rnd(-40,40), rnd(0.3,0.6), rnd(3,6), 255,120,90);
              AddRing(g_warnX,BOX_CY,60,255,120,140);
            }
            AddShake(0.25,5);
            g_spawnT=1.0/ramp;
          }
        }
      }
      // ---- Pink：白猫冲锋
      if (g_pattern===P_MAGIC){
        if (g_waveN<12 && g_spawnT<=0 && g_stateT<B.dur-1.2){
          g_spawnT=0.95/ramp;
          const N=4, step=(BOX_Y1-BOX_Y0-30)/(N-1);
          const gap=randInt(N);
          const speed=(215+Math.min(g_waveN,5)*20)*ramp;
          for (let i=0;i<N;++i){
            if (i===gap) continue;
            const y=BOX_Y0+15+i*step;
            SpawnBulletAt(B_WHITECAT, BOX_X1+24, y, -speed, 0, 10);
            const b=g_bullets[g_bullets.length-1];
            b.dmg=13; b.rotv=0;
          }
          AddRing(BOX_X1-6,BOX_CY,46,255,250,250);
          g_waveN++;
        }
      }
      // ---- Pink：喵喵炸弹
      if (g_pattern===P_LOVE && g_spawnT<=0){
        g_spawnT=1.10/ramp;
        const bias=g_loveN%4;
        let bx;
        if (bias===0)      bx=rnd(BOX_X0+10,BOX_X0+40);
        else if (bias===1) bx=rnd(BOX_X1-40,BOX_X1-10);
        else               bx=rnd(BOX_X0+10,BOX_X1-10);
        SpawnBulletAt(B_CATBOMB, bx, BOX_Y0-20, 0, rnd(120,155)*ramp, 14);
        const b=g_bullets[g_bullets.length-1];
        b.life=rnd(0.26,0.95); b.rotv=2.4; b.dmg=10; b.phase=rnd(0,6.28);
        g_loveN++;
      }
      // ---- Pink：猫爪
      if (g_pattern===P_MEOW){
        if (g_knifeWarn<0 && g_spawnT<=0){
          g_knifeWarn=0.32; g_warnSide=randInt(4);
          if (g_warnSide<=1){ g_warnY=g_heartY; g_warnX=0; }
          else             { g_warnX=g_heartX; g_warnY=0; }
        }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            const spd=430*ramp;
            if (g_warnSide===0)      SpawnBulletAt(B_PAW, BOX_X0-26, g_warnY,  spd, 0, 15);
            else if (g_warnSide===1) SpawnBulletAt(B_PAW, BOX_X1+26, g_warnY, -spd, 0, 15);
            else if (g_warnSide===2) SpawnBulletAt(B_PAW, g_warnX, BOX_Y0-26, 0,  spd, 15);
            else                     SpawnBulletAt(B_PAW, g_warnX, BOX_Y1+26, 0, -spd, 15);
            g_bullets[g_bullets.length-1].dmg=15;
            g_spawnT=0.55/ramp;
          }
        }
      }
      // ---- Pink：幽灵分身
      if (g_pattern===P_GHOST && g_spawnT<=0){
        g_spawnT=1.25/ramp;
        for (let k=0;k<2;++k){
          const a=rnd(0,6.2832);
          SpawnBulletAt(B_GHOST, BOX_CX+Math.cos(a)*170, BOX_CY+Math.sin(a)*75,
                        -Math.cos(a)*60, -Math.sin(a)*35, 13);
          const b=g_bullets[g_bullets.length-1];
          b.life=-1; b.dmg=14;
        }
      }
    }

    // ---- 更新子弹（spawned 缓冲防爆）
    const spawned=[];
    for (const b of g_bullets){
      if (b.type===B_CROSS){
        b.rotv+=dt;
        const grow=980*dt;
        if (b.life<660) b.life=Math.min(b.life+grow,660);
        const ex=b.x+b.vx*b.life, ey=b.y+b.vy*b.life;
        const d=distToSeg(g_heartX,g_heartY,b.x,b.y,ex,ey);
        if (d<b.r+6) HitPlayer(b.dmg);
        if (b.rotv>0.70) b.x=-9999;
        continue;
      }
      if (b.life>0 && !b.ring && b.vx===0 && b.vy===0){      // 激光
        b.life-=dt;
        const hitLine = (b.rx>0.5) ? Math.abs(g_heartY-b.y)<10 : Math.abs(g_heartX-b.x)<10;
        if (hitLine) HitPlayer(b.dmg);
        if (b.life<=0) b.x=-9999;
        continue;
      }
      if (b.ring){
        b.ang+=b.w*dt;
        b.x=b.cx+Math.cos(b.ang)*b.rx;
        b.y=b.cy+Math.sin(b.ang)*b.ry;
        b.rot+=b.rotv*dt;
      } else {
        if (b.type===B_CATBOMB){
          b.life-=dt; b.rot+=b.rotv*dt; b.vy+=60*dt;
          b.x+=b.vx*dt; b.y+=b.vy*dt;
          if (b.life<=0 || b.y>=BOX_Y1-14){
            AddRing(b.x,b.y,70,255,140,190);
            BurstParts(b.x,b.y,20,190,255,150,200,0.6);
            AddShake(0.38,6.5);
            const dir4=[[1,0],[-1,0],[0,1],[0,-1]];
            for (let i=0;i<4;++i){
              spawned.push({type:B_CROSS, ring:false, x:b.x, y:b.y,
                vx:dir4[i][0], vy:dir4[i][1], rot:0, rotv:0, r:11, dmg:13,
                life:0, phase:0, ang:0, rx:0, ry:0, w:0, cx:0, cy:0});
            }
            b.x=-9999; b.life=-2;
          }
          continue;
        }
        if (b.type===B_BOMB){
          b.life-=dt; b.rot+=b.rotv*dt;
          if (b.life<=0){
            AddRing(b.x,b.y,70,255,190,120);
            BurstParts(b.x,b.y,18,200,255,180,100,0.6);
            AddShake(0.3,5);
            for (let i=0;i<8;++i){
              const a=i*0.7854+b.phase;
              spawned.push({type:B_BOMB, ring:false, x:b.x, y:b.y,
                vx:Math.cos(a)*190*ramp, vy:Math.sin(a)*150*ramp,
                dmg:14, rotv:0, r:10, life:0, rot:0,
                phase:0, ang:0, rx:0, ry:0, w:0, cx:0, cy:0});
            }
            for (let i=0;i<4;++i){
              const a=i*1.5708;
              spawned.push({type:B_BOMB, ring:false, x:b.x, y:b.y,
                vx:Math.cos(a)*340*ramp, vy:Math.sin(a)*280*ramp,
                dmg:14, rotv:0, r:10, life:0, rot:0,
                phase:0, ang:0, rx:0, ry:0, w:0, cx:0, cy:0});
            }
            b.x=-9999; b.life=-2;
          }
          continue;
        }
        if (b.life<0){                       // 追踪弹
          const dx=g_heartX-b.x, dy=g_heartY-b.y;
          const d=Math.hypot(dx,dy)+0.001;
          b.vx+=dx/d*260*dt; b.vy+=dy/d*260*dt;
          const sp2=Math.hypot(b.vx,b.vy), maxs=165*ramp;
          if (sp2>maxs){ b.vx*=maxs/sp2; b.vy*=maxs/sp2; }
        }
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        b.rot+=b.rotv*dt;
        if (b.type===B_DIAMOND) b.x+=Math.sin(g_stateT*3+b.phase)*22*dt;
        if (b.type===B_COIN)    b.y+=Math.sin(g_stateT*4+b.phase)*34*dt;
        if (b.type===B_MAIL)    b.x+=Math.sin(g_stateT*3.2+b.phase)*18*dt;
      }
      // 碰撞
      const dx=b.x-g_heartX, dy=b.y-g_heartY;
      if (dx*dx+dy*dy < (b.r+7)*(b.r+7)*0.80)
        HitPlayer(b.dmg>0?b.dmg:12);
    }
    if (spawned.length) g_bullets.push(...spawned);
    g_bullets = g_bullets.filter(b=>{
      if (b.ring) return true;
      if ((b.type===B_BOMB||b.type===B_CATBOMB) && b.life<=-2) return false;
      if (b.type===B_WHITECAT) return !(b.x<BOX_X0-90);
      return !(b.x<BOX_X0-60 || b.x>BOX_X1+60 || b.y<BOX_Y0-60 || b.y>BOX_Y1+60);
    });

    if (g_stateT>B.dur && g_state===ST_ATTACK){
      g_bullets=[];
      g_turn++;
      g_state=ST_MENU; g_stateT=0; Say("");
    }
    break;
  }
  }
}

// ---------------- 输入 ----------------
const keys = new Set();
let touchTarget = null;        // {x,y} 逻辑坐标
let touchActive = false;
let touchStart = null;         // 判定点按 vs 拖动

// 每帧渲染时重建的点击热区
let hotspots = [];
function hot(x,y,w,h,fn){ hotspots.push({x,y,w,h,fn}); }

function pressKey(vk){        // 统一按键处理（键盘 + 触屏等价）
  // ---- 主界面
  if (g_state===ST_TITLE){
    if (vk==="ArrowLeft"){ g_bossSel=(g_bossSel+BOSS_N-1)%BOSS_N; playSfx("snd_menu_move"); }
    if (vk==="ArrowRight"){ g_bossSel=(g_bossSel+1)%BOSS_N; playSfx("snd_menu_move"); }
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); StartBattle(g_bossSel); }
    return;
  }
  // ---- 暂停
  if (g_state===ST_PAUSE){
    if (vk==="ArrowUp"){ g_pauseSel=(g_pauseSel+2)%3; playSfx("snd_menu_move"); }
    if (vk==="ArrowDown"){ g_pauseSel=(g_pauseSel+1)%3; playSfx("snd_menu_move"); }
    if (vk==="ArrowLeft"||vk==="ArrowRight"){
      if (g_pauseSel===1){
        g_vol=clamp(g_vol+(vk==="ArrowLeft"?-10:10),0,100);
        bgm.volume=g_vol/100; playSfx("snd_menu_move");
      }
    }
    if (vk==="Escape"){ g_state=g_pauseFrom; playSfx("snd_menu_move"); return; }
    if (vk==="z"||vk==="Enter"){
      if (g_pauseSel===0){ playSfx("snd_menu_select"); g_state=g_pauseFrom; }
      else if (g_pauseSel===2){ playSfx("snd_menu_select"); GoTitle(); }
    }
    return;
  }
  switch (g_state){
  case ST_MENU:
    if (vk==="ArrowLeft"){ g_btnSel=(g_btnSel+3)%4; playSfx("snd_menu_move"); }
    if (vk==="ArrowRight"){ g_btnSel=(g_btnSel+1)%4; playSfx("snd_menu_move"); }
    if (vk==="z"||vk==="Enter"){
      playSfx("snd_menu_select");
      if (g_btnSel===0){ g_state=ST_FIGHT; g_stateT=0; g_barX=250; g_barHit=false; }
      else {
        g_sub = g_btnSel===1?SM_ACT : g_btnSel===2?SM_ITEM : SM_MERCY;
        g_subSel=0; g_state=ST_SUB; g_stateT=0;
      }
    }
    break;
  case ST_SUB: {
    const n = g_sub===SM_ACT?2 : g_sub===SM_ITEM?1 : 2;
    if (vk==="ArrowUp"){ g_subSel=(g_subSel+n-1)%n; playSfx("snd_menu_move"); }
    if (vk==="ArrowDown"){ g_subSel=(g_subSel+1)%n; playSfx("snd_menu_move"); }
    if (vk==="x"){ g_state=ST_MENU; g_sub=SM_NONE; playSfx("snd_menu_move"); }
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); DoPlayerAction(); }
    break;
  }
  case ST_FIGHT:
    if (vk==="z"||vk==="Enter"){
      playSfx("snd_slash");
      const c=(250+392)*0.5;
      let acc=1.0-Math.abs(g_barX-c)/71.0;
      if (acc<0) acc=0;
      g_pendingDmg=Math.floor(16+acc*acc*acc*58);
      g_barHit=true;
      HitJevil(g_pendingDmg);
      g_state=ST_DMG; g_stateT=0;
    }
    break;
  case ST_WIN: case ST_LOSE:
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); ResetGame(); }
    break;
  }
  if (vk==="Escape" && g_state>=ST_INTRO && g_state!==ST_PAUSE){
    g_pauseFrom=g_state; g_pauseSel=0; g_state=ST_PAUSE; playSfx("snd_menu_move");
  }
}

window.addEventListener("keydown", e=>{
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
  if (!e.repeat) pressKey(e.key.length===1 ? e.key.toLowerCase() : e.key);
  keys.add(e.key);
});
window.addEventListener("keyup", e=>keys.delete(e.key));

// ---- 触屏 / 鼠标 ----
const cv = document.getElementById("cv");
function toLogical(clientX, clientY){
  const r = cv.getBoundingClientRect();
  return { x:(clientX-r.left)/r.width*WINW, y:(clientY-r.top)/r.height*WINH };
}
cv.addEventListener("pointerdown", e=>{
  e.preventDefault();
  const p = toLogical(e.clientX, e.clientY);
  if (g_state===ST_ATTACK){
    touchActive=true; touchTarget=p; touchStart={...p, t:performance.now()};
    return;
  }
  touchStart={...p, t:performance.now()};
});
cv.addEventListener("pointermove", e=>{
  if (!touchActive) return;
  e.preventDefault();
  touchTarget = toLogical(e.clientX, e.clientY);
});
function endPointer(e){
  const wasAttack = touchActive;
  touchActive=false; touchTarget=null;
  if (!touchStart) return;
  const p = toLogical(e.clientX, e.clientY);
  const moved = Math.hypot(p.x-touchStart.x, p.y-touchStart.y);
  const isTap = moved < 14 && (performance.now()-touchStart.t) < 600;
  touchStart=null;
  if (!isTap) return;
  // 热区（从后往前 = 最上层优先）
  for (let i=hotspots.length-1;i>=0;--i){
    const h=hotspots[i];
    if (p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){ h.fn(); return; }
  }
  // 无热区兜底
  if (g_state===ST_FIGHT) pressKey("z");
  else if (g_state===ST_WIN || g_state===ST_LOSE) pressKey("z");
  else if (g_state===ST_DIALOG || g_state===ST_INTRO) g_stateT=Math.max(g_stateT, 1.99);
}
cv.addEventListener("pointerup", e=>{ e.preventDefault(); endPointer(e); });
cv.addEventListener("pointercancel", ()=>{ touchActive=false; touchTarget=null; touchStart=null; });

// ---------------- 渲染 ----------------
const ctx = cv.getContext("2d");
let SS = 1;                          // 超采样倍数
let crtCanvas = null, crtDirty = true;

function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  SS = clamp(Math.round(dpr*10)/10, 1, 2);   // 最高 2 倍超采样，兼顾手机性能
  const ww = window.innerWidth, wh = window.innerHeight;
  const sc = Math.min(ww/WINW, wh/WINH);
  cv.style.width  = Math.floor(WINW*sc)+"px";
  cv.style.height = Math.floor(WINH*sc)+"px";
  cv.width  = Math.floor(WINW*sc*SS);
  cv.height = Math.floor(WINH*sc*SS);
  const hint = document.getElementById("rotate");
  if (hint) hint.style.display = (ww < wh && ww < 820) ? "block" : "none";
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

function img(n){ const im=IMG[n]; return (im && im.naturalWidth) ? im : null; }

function drawImg(im, cx, cy, w, h, rot=0){
  if (!im) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (Math.abs(rot)>0.01) ctx.rotate(rot*Math.PI/180);
  ctx.drawImage(im, -w/2, -h/2, w, h);
  ctx.restore();
}
// 描边文字（居中 or 左对齐）
function outlineText(s, x, y, size, color, cxAlign, bold=true){
  ctx.font = `${bold?"bold ":""}${size}px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = cxAlign>=0 ? "center" : "left";
  const px = cxAlign>=0 ? cxAlign : x;
  ctx.fillStyle = "rgb(20,10,25)";
  for (const [ox,oy] of [[-2,0],[2,0],[0,-2],[0,2],[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]])
    ctx.fillText(s, px+ox, y+oy);
  ctx.fillStyle = color;
  ctx.fillText(s, px, y);
}

function GetCrt(){
  if (crtCanvas && !crtDirty) return crtCanvas;
  crtCanvas = document.createElement("canvas");
  crtCanvas.width = WINW; crtCanvas.height = WINH;
  const c = crtCanvas.getContext("2d");
  const scanA = g_boss===1 ? 34 : 20;
  c.fillStyle = `rgba(0,0,0,${scanA/255})`;
  for (let y=0;y<WINH;y+=4) c.fillRect(0,y,WINW,1.4);
  for (let i=0;i<6;++i){
    c.strokeStyle = `rgba(0,0,0,${(14+i*8)/255})`;
    c.lineWidth = 10;
    c.strokeRect(i*5, i*5, WINW-i*10, WINH-i*10);
  }
  crtDirty = false;
  return crtCanvas;
}

// ---- 主界面
function RenderTitle(){
  ctx.fillStyle = "rgb(12,8,22)";
  ctx.fillRect(0,0,WINW,WINH);
  for (let i=0;i<5;++i){
    const y = (g_animT*26+i*120) % (WINH+120) - 60;
    ctx.fillStyle = "rgba(120,200,255,0.09)";
    ctx.fillRect(0,y,WINW,42);
  }
  outlineText("混沌挑战", 0, 22, 56, "#ffec78", WINW/2);
  outlineText("CHOOSE  YOUR  CHAOS", 0, 92, 15, "#c8dcff", WINW/2, false);

  for (let i=0;i<BOSS_N;++i){
    const x=34+i*146, y=118, w=132, h=214;
    const sel = i===g_bossSel;
    ctx.fillStyle = sel ? "rgba(52,30,62,0.94)" : "rgba(22,16,34,0.75)";
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = sel ? "#ffe878" : "rgba(130,130,160,0.6)";
    ctx.lineWidth = sel?3:1.5;
    ctx.strokeRect(x,y,w,h);
    // 立绘
    let im=null;
    if (i===0){ const n=jevilJumpN(); im = n>0 ? IMG["jevil_jump_0"] : img("jevil"); }
    else if (i===1){ const n=frameCount("tenna_",8); im = n>0?IMG["tenna_"+(Math.floor(g_animT*5)%n)]:(img("spamton_0")||img("spamton_neo")); }
    else if (i===2){ const n=frameCount("neo_",8);   im = n>0?IMG["neo_"+(Math.floor(g_animT*5)%n)]:img("spamton_neo"); }
    else           { const n=frameCount("pink_",8);  im = n>0?IMG["pink_"+(Math.floor(g_animT*5)%n)]:img("mad_mew_mew"); }
    const cy = y+72+(sel?Math.sin(g_animT*4)*4:0);
    if (im && im.naturalWidth){
      const iw=im.naturalWidth, ih=im.naturalHeight;
      const k=94/Math.max(iw,ih);
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(im, x+w/2, cy, iw*k, ih*k);
      ctx.restore();
    }
    outlineText(BOSSES[i].name, 0, y+142, 22, sel?"#fff08c":"#d6d2dc", x+w/2);
    let sub = BOSSES[i].title;
    const dot = sub.indexOf("·");
    if (dot>=0) sub = sub.slice(dot+1);
    outlineText(sub, 0, y+172, 15, "#bec8dc", x+w/2, false);
    let star=""; for (let s=0;s<=i;++s) star+="★";
    outlineText(star, 0, y+192, 15, "#ff7896", x+w/2, false);
    // 触屏：点卡片选择，再点一次开战
    hot(x, y, w, h, ()=>{
      if (g_bossSel===i){ playSfx("snd_menu_select"); StartBattle(i); }
      else { g_bossSel=i; playSfx("snd_menu_move"); }
    });
  }
  if (isTouch)
    outlineText("点选角色　再点一次开战", 0, 352, 15, "#d2dce1", WINW/2, false);
  else
    outlineText("← → 选择　Z 开战", 0, 352, 15, "#d2dce1", WINW/2, false);
}

// ---- 暂停
function RenderPause(){
  ctx.fillStyle = "rgba(0,0,0,0.80)";
  ctx.fillRect(0,0,WINW,WINH);
  outlineText("暂　停", 0, 56, 56, "#ffec78", WINW/2);

  // 继续游戏
  outlineText("继续游戏", 0, 168, 24, g_pauseSel===0?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===0){ ctx.save(); ctx.imageSmoothingEnabled=false; drawImg(img("soul"), WINW/2-104, 180, 24,24); ctx.restore(); }
  hot(WINW/2-140, 158, 280, 52, ()=>{ playSfx("snd_menu_select"); g_state=g_pauseFrom; });

  // 音量
  outlineText(`音量　　${g_vol}%`, 0, 238, 24, g_pauseSel===1?"#fff":"#c2becd", WINW/2);
  const bx = WINW/2-100, by = 282, bw = 200, bh = 12;
  ctx.fillStyle="rgba(60,60,90,0.9)"; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle="#78d2ff"; ctx.fillRect(bx,by,bw*g_vol/100,bh);
  ctx.strokeStyle="rgba(200,200,240,0.5)"; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,bh);
  btn(bx-72, by-12, 48, 36, "－", ()=>{ g_vol=clamp(g_vol-10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  btn(bx+bw+24, by-12, 48, 36, "＋", ()=>{ g_vol=clamp(g_vol+10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  hot(bx-10, by-20, bw+20, 44, ()=>{ g_pauseSel=1; });

  // 退出
  outlineText("退出挑战", 0, 348, 24, g_pauseSel===2?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===2){ ctx.save(); ctx.imageSmoothingEnabled=false; drawImg(img("soul"), WINW/2-104, 360, 24,24); ctx.restore(); }
  hot(WINW/2-140, 338, 280, 52, ()=>{ playSfx("snd_menu_select"); GoTitle(); });

  if (!isTouch) outlineText("↑ ↓ 选择　Z 确认　ESC 继续", 0, 430, 15, "#bec8cd", WINW/2, false);
}
// 简单按钮（描边圆角）
function btn(x,y,w,h,label,fn){
  ctx.fillStyle="rgba(60,50,90,0.9)";
  ctx.strokeStyle="#9a8ec0"; ctx.lineWidth=2;
  roundRect(x,y,w,h,8); ctx.fill(); ctx.stroke();
  outlineText(label, 0, y+h/2-11, 20, "#fff", x+w/2);
  hot(x-6,y-6,w+12,h+12,fn);
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// ---- 战斗渲染主函数
function Render(){
  hotspots = [];
  ctx.setTransform(cv.width/WINW, 0, 0, cv.height/WINH, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0,0,WINW,WINH);

  if (g_state===ST_TITLE){ RenderTitle(); return; }
  if (g_state===ST_PAUSE){                 // 暂停只画背景 + 菜单，避免战斗画面文字叠影
    const bg0 = img("bg");
    if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
    ctx.drawImage(GetCrt(), 0, 0, WINW, WINH);
    RenderPause();
    return;
  }

  // 震屏
  let shx=0, shy=0;
  if (g_shakeT>0){ shx=rnd(-g_shakeMag,g_shakeMag); shy=rnd(-g_shakeMag,g_shakeMag)*0.7; }
  ctx.save();
  ctx.translate(shx, shy);

  // 背景
  const bg = img("bg");
  if (bg) ctx.drawImage(bg, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(30,15,50)"; ctx.fillRect(-6,-6,WINW+12,WINH+12); }

  const bob = Math.sin(g_animT*2.6)*6;
  let sx=0, sy=0;
  if (g_jevShake>0){ sx=rnd(-6,6); sy=rnd(-4,4); }
  sx+=shx; sy+=shy;

  // ---- boss 立绘
  let jx = JEV_CX + g_jevOffX*(g_state===ST_ATTACK?1:0);
  let jy = JEV_CY + g_jevOffY*(g_state===ST_ATTACK?1:0) + bob + sy;
  if (g_state===ST_INTRO)
    jy = -180 + (JEV_CY+bob)*Math.min(1, g_stateT/1.1);
  if (g_state!==ST_LOSE){
    let jf=null, jw=158, jh=168;
    if (g_boss===0){
      if (g_state===ST_WIN){ jf=img("jevil_spared")||img("jevil"); const sc=1+Math.sin(g_animT*2)*0.03; jw*=sc; jh*=sc; }
      else if (g_hitFlash>0 && frameCount("jevil_hurt_",8)>0){
        jf=IMG["jevil_hurt_"+(Math.floor(g_animT*24)%8)]; jw=200; jh=130;
      }
      else if (g_jevHp<Boss().maxhp*0.25 && img("jevil_tired")) jf=img("jevil_tired");
      else { const n=jevilJumpN(); jf = n>0?IMG["jevil_jump_"+(Math.floor(g_animT*9)%n)]:img("jevil"); }
    } else {
      jf = BossFrame(g_boss, g_hitFlash>0);
      if (g_boss===1){ jw=220; jh=340; }
      else if (g_boss===2){ jw=236; jh=336; }
      else { jw=210; jh=215; }
      if (g_jevHp<Boss().maxhp*0.25){ jx+=rnd(-3,3); jy+=rnd(-3,3); }
      if (g_hitFlash>0){ jx+=rnd(-5,5); }
    }
    if (jf){
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(jf, jx+sx, jy, jw, jh);
      ctx.restore();
    }
  }
  // 命中白闪
  if (g_hitFlash>0){
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1,g_hitFlash*2)})`;
    ctx.beginPath(); ctx.ellipse(jx-85+sx, jy-95+190/2, 85, 95, 0, 0, 6.29); ctx.fill();
  }
  // boss 血条
  if (g_jevHpShown && g_state!==ST_WIN && g_state!==ST_LOSE){
    ctx.fillStyle="rgba(30,20,35,0.8)"; ctx.fillRect(220,14,200,10);
    ctx.fillStyle="#78c8ff"; ctx.fillRect(220,14,200*(g_jevHp/Boss().maxhp),10);
    ctx.strokeStyle="rgba(240,240,255,0.86)"; ctx.lineWidth=1.6; ctx.strokeRect(220,14,200,10);
    outlineText(Boss().name, 0, -2, 15, "#dcdcf0", WINW/2, false);
  }
  // ---- 特效星光
  for (const s of g_sparks){
    const t=s.t/0.55, sc=s.scale*(0.4+t*1.4), a=1-t;
    const im=img("sparkle");
    if (im){
      ctx.save(); ctx.globalAlpha=Math.max(0,a); ctx.imageSmoothingEnabled=false;
      drawImg(im, s.x, s.y, 28*sc, 28*sc, g_animT*80);
      ctx.restore();
    }
  }

  // ---- 战斗框
  if (g_state!==ST_WIN && g_state!==ST_LOSE) {
    const breathe = 0.5+0.5*Math.sin(g_animT*2.2);
    ctx.fillStyle="rgba(5,3,12,0.59)";
    ctx.fillRect(BOX_X0, BOX_Y0, BOX_X1-BOX_X0, BOX_Y1-BOX_Y0);
    ctx.strokeStyle=`rgba(245,245,250,${(200+40*breathe)/255})`;
    ctx.lineWidth=4;
    ctx.strokeRect(BOX_X0, BOX_Y0, BOX_X1-BOX_X0, BOX_Y1-BOX_Y0);
  }
  const inBoxView = (g_state===ST_ATTACK || g_state===ST_LOSE);

  // ---- 攻击预警
  if (g_state===ST_ATTACK && g_stateT<Boss().warn){
    const k=g_stateT/Boss().warn;
    const pulse=0.5+0.5*Math.sin(g_animT*20);
    ctx.strokeStyle=`rgba(255,80,80,${(110+130*pulse)/255})`;
    ctx.lineWidth=3;
    ctx.strokeRect(BOX_X0,BOX_Y0,BOX_X1-BOX_X0,BOX_Y1-BOX_Y0);
    renderWarn(pulse);
    // 技能名
    let nm="混沌！";
    for (let i=0;i<4;++i) if (Boss().pat[i]===g_pattern){ nm=Boss().patLine[i]; break; }
    outlineText(nm, 0, BOX_CY-22, 34, `rgba(255,${Math.floor(90+120*pulse)},${Math.floor(90+60*pulse)},1)`, WINW/2);
  }

  // ---- 子弹
  if (inBoxView){
    const sz=[30,28,30,52,34,30,30,26,30,28,30,32,34,27,30];
    const imKeys=["spade","diamond","club","knife","phone","coin","mail","heart","bomb",
                  "star","paw","ghost","catbomb","whitecat",null];
    for (const b of g_bullets){
      if (b.type===B_CROSS){
        const fade = b.rotv<0.45 ? 1 : Math.max(0, 1-(b.rotv-0.45)/0.25);
        const ex=b.x+b.vx*b.life, ey=b.y+b.vy*b.life;
        const pulsew=21+3*Math.sin(g_animT*22);
        const nx=-b.vy, ny=b.vx, hw=pulsew*0.5;
        ctx.save();
        ctx.beginPath(); ctx.rect(BOX_X0,BOX_Y0,BOX_X1-BOX_X0,BOX_Y1-BOX_Y0); ctx.clip();
        ctx.fillStyle=`rgba(255,120,175,${0.80*fade})`;
        ctx.beginPath();
        ctx.moveTo(b.x+nx*hw, b.y+ny*hw); ctx.lineTo(ex+nx*hw, ey+ny*hw);
        ctx.lineTo(ex-nx*hw, ey-ny*hw);   ctx.lineTo(b.x-nx*hw, b.y-ny*hw);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle=`rgba(255,235,248,${0.98*fade})`;
        ctx.beginPath();
        ctx.moveTo(b.x+nx*4, b.y+ny*4); ctx.lineTo(ex+nx*4, ey+ny*4);
        ctx.lineTo(ex-nx*4, ey-ny*4);   ctx.lineTo(b.x-nx*4, b.y-ny*4);
        ctx.closePath(); ctx.fill();
        const hr=8+2*Math.sin(g_animT*26+b.phase);
        ctx.fillStyle=`rgba(255,255,255,${0.88*fade})`;
        ctx.beginPath(); ctx.arc(ex,ey,hr,0,6.29); ctx.fill();
        ctx.restore();
        continue;
      }
      // 激光
      if (b.life>0 && !b.ring && b.vx===0 && b.vy===0){
        const a=Math.min(1, b.life*2.5);
        ctx.fillStyle=`rgba(255,90,120,${0.78*a})`;
        if (b.rx>0.5){
          ctx.fillRect(BOX_X0, b.y-9, BOX_X1-BOX_X0, 18);
          ctx.strokeStyle=`rgba(255,240,240,${a})`; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(BOX_X0,b.y-9); ctx.lineTo(BOX_X1,b.y-9);
          ctx.moveTo(BOX_X0,b.y+9); ctx.lineTo(BOX_X1,b.y+9); ctx.stroke();
        } else {
          ctx.fillRect(b.x-9, BOX_Y0, 18, BOX_Y1-BOX_Y0);
          ctx.strokeStyle=`rgba(255,240,240,${a})`; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(b.x-9,BOX_Y0); ctx.lineTo(b.x-9,BOX_Y1);
          ctx.moveTo(b.x+9,BOX_Y0); ctx.lineTo(b.x+9,BOX_Y1); ctx.stroke();
        }
        continue;
      }
      let sz2 = sz[b.type];
      if (b.type===B_BOMB||b.type===B_CATBOMB) sz2=30+2.5*Math.sin(g_animT*12+b.phase);
      if (b.type===B_WHITECAT) sz2=34;                 // 白猫放大一点，手机上更醒目
      if (b.type===B_CATBOMB)  sz2*=1.30;
      const im = img(imKeys[b.type]);
      if (im){
        ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(im, b.x, b.y, sz2, sz2, b.rot*57.3);
        ctx.restore();
      }
    }
  }

  // ---- 粒子
  for (const p of g_parts){
    const t=p.life/p.maxlife;
    ctx.fillStyle=`rgba(${p.cr},${p.cg},${p.cb},${0.94*t})`;
    const ps=p.size*(0.5+t*0.8);
    ctx.fillRect(p.x-ps/2, p.y-ps/2, ps, ps);
  }
  // ---- 冲击环
  for (const r of g_rings){
    const t=r.t/0.45, rr=r.maxR*(0.25+0.75*t);
    ctx.strokeStyle=`rgba(${r.cr},${r.cg},${r.cb},${0.86*(1-t)})`;
    ctx.lineWidth=3*(1-t)+1;
    ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, 6.29); ctx.stroke();
  }

  // ---- 镰刀预警线
  if (g_state===ST_ATTACK && g_pattern===P_KNIVES && g_knifeWarn>=0){
    ctx.strokeStyle=`rgba(255,60,60,${(150+100*Math.sin(g_animT*30))/255})`;
    ctx.lineWidth=2.5;
    if (g_warnSide<=1){
      ctx.beginPath(); ctx.moveTo(BOX_X0+4,g_warnY); ctx.lineTo(BOX_X1-4,g_warnY); ctx.stroke();
      const im=img("sparkle");
      if (im){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(im, g_warnSide>0?BOX_X1-16:BOX_X0+16, g_warnY, 34,34, g_animT*200); ctx.restore(); }
    } else {
      ctx.beginPath(); ctx.moveTo(g_warnX,BOX_Y0+4); ctx.lineTo(g_warnX,BOX_Y1-4); ctx.stroke();
      const im=img("sparkle");
      if (im){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(im, g_warnX, g_warnSide===2?BOX_Y0+16:BOX_Y1-16, 34,34, g_animT*200); ctx.restore(); }
    }
  }

  // ---- 红心
  if (inBoxView){
    const vis = g_inv<=0 || (g_animT%0.16)<0.09;
    if (g_state===ST_LOSE){
      const t=Math.min(1, g_stateT/0.8);
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(img("soul"), g_heartX-t*26, g_heartY-t*8, 24,24, -t*90);
      drawImg(img("soul"), g_heartX+t*26, g_heartY-t*8, 24,24, t*90);
      ctx.restore();
    } else if (vis){
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(img("soul"), g_heartX, g_heartY, 28,28);
      ctx.restore();
    }
  }
  ctx.restore();   // 震屏结束

  // ---- 字幕
  if (g_subtitle)
    outlineText(g_subtitle, 0, 246, 20, "#ffe058", WINW/2);
  // 触屏操作提示（第一轮弹幕时出现）
  if (isTouch && g_state===ST_ATTACK && g_turn===0 && g_stateT<3.5)
    outlineText("按住屏幕拖动红心躲避", 0, 464, 14, "#c8d8ff", WINW/2, false);

  // ---- 底部 UI
  if (g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_INTRO){
    outlineText("HP", 14, 432, 22, "#ffe678", -1);
    ctx.fillStyle="rgba(40,15,25,0.86)"; ctx.fillRect(46,436,110,18);
    ctx.fillStyle="#ffc850"; ctx.fillRect(46,436,110*(g_hp/PLAYER_MAXHP),18);
    ctx.fillStyle="rgba(255,255,200,0.9)"; ctx.fillRect(46,436,110*(g_hp/PLAYER_MAXHP),6);
    ctx.strokeStyle="rgba(240,240,245,1)"; ctx.lineWidth=1.6; ctx.strokeRect(46,436,110,18);
    outlineText(`${Math.ceil(g_hp)}/${Math.floor(PLAYER_MAXHP)}`, 160, 434, 15, "#fff", -1, false);

    // 按钮（四个常驻显示，仅主菜单可点）
    const btnKeys=["btn_fight","btn_act","btn_item","btn_mercy"];
    for (let i=0;i<4;++i){
      let bx=236+i*102, by=430, bw=98, bh=34;
      const sel = (g_state===ST_MENU && g_btnSel===i);
      if (sel){ bw+=8; bh+=6; bx-=4; by-=3;
        ctx.strokeStyle="rgba(255,255,255,0.63)"; ctx.lineWidth=2;
        ctx.strokeRect(bx-2,by-2,bw+4,bh+4);
      }
      const im=img(btnKeys[i]);
      ctx.save();
      ctx.globalAlpha = (g_state===ST_MENU||g_state===ST_SUB) ? 1 : 0.72;
      if (im){ ctx.imageSmoothingEnabled=false; drawImg(im, bx+bw/2, by+bh/2, bw, bh); }
      ctx.restore();
      if (g_state===ST_MENU)
        hot(bx-8, by-8, bw+16, bh+16, ()=>{ g_btnSel=i; pressKey("z"); });
    }
  }

  // ---- FIGHT 时机条
  if (g_state===ST_FIGHT || (g_state===ST_DMG && g_stateT<0.4)){
    ctx.fillStyle="rgba(10,6,18,0.78)"; ctx.fillRect(250,60,142,190);
    ctx.strokeStyle="#fffafa"; ctx.lineWidth=3; ctx.strokeRect(250,60,142,190);
    ctx.strokeStyle="#ffdc5a"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(321,60); ctx.lineTo(321,250); ctx.stroke();
    if (!g_barHit || g_stateT<0.35){
      ctx.fillStyle="#ff3c3c";
      ctx.fillRect(g_barX-3, 60, 6, 190);
    }
    outlineText(isTouch?"点按屏幕出刀！":"按 Z 出刀！", 0, 256, 15, "#fff", WINW/2, false);
  }

  // ---- 子菜单
  if (g_state===ST_SUB){
    let opts=[], n=0;
    if (g_sub===SM_ACT){ opts=["检查","安抚"]; n=2; }
    if (g_sub===SM_ITEM){ opts=[g_items?"魔法软糖（回复60）":"（空空如也）"]; n=1; }
    if (g_sub===SM_MERCY){ opts=["饶恕","逃跑"]; n=2; }
    for (let i=0;i<n;++i){
      const y=BOX_Y0+24+i*42;
      outlineText(opts[i], BOX_X0+46, y-10, 22, i===g_subSel?"#fff":"#d8c8d2", -1);
      if (i===g_subSel){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(img("soul"), BOX_X0+26, y, 26,26); ctx.restore(); }
      hot(BOX_X0+20, y-22, BOX_X1-BOX_X0-40, 40, ()=>{ g_subSel=i; pressKey("z"); });
    }
    if (g_sub===SM_MERCY && g_spareReady){
      const im=img("sparkle");
      if (im){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(im, BOX_X1-40, BOX_Y0+30, 36,36, g_animT*160); ctx.restore(); }
      outlineText("!!", BOX_X1-66, BOX_Y0+20, 22, "#ffe65a", -1);
    }
    hot(BOX_X1-84, BOX_Y0+8, 72, 30, ()=>pressKey("x"));
    outlineText("返回", BOX_X1-74, BOX_Y0+12, 15, "#9aa8c8", -1, false);
  }

  // ---- 伤害数字
  for (const d of g_dmg){
    const a=Math.min(1, d.life*2);
    outlineText(d.miss?"MISS":String(d.val), d.x, d.y, 34, d.miss?`rgba(180,180,190,${a})`:`rgba(255,235,80,${a})`, d.x);
  }

  // ---- 胜利 / 失败
  if (g_state===ST_WIN || g_state===ST_LOSE){
    ctx.fillStyle="rgba(0,0,0,0.72)"; ctx.fillRect(0,0,WINW,WINH);
    const im=img("sparkle");
    if (im){
      ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<14;++i){
        const t=(g_animT*0.35+i*0.137)%1;
        const y=WINH-t*WINH, x=(i*149)%WINW;
        drawImg(im, x, y, 26,26, g_animT*90+i*30);
      }
      ctx.restore();
    }
    const big = g_state===ST_WIN?"胜  利 ！":"GAME OVER";
    outlineText(big, 0, 150, 56, g_state===ST_WIN?"#ffeb5a":"#ff4646", WINW/2);
    const flavor = g_state===ST_WIN
      ? (g_spareReady ? `${Boss().name}安静下来，做了一个甜甜的梦……` : `${Boss().name}被打倒了，混沌暂时散去……`)
      : "但你还有机会——重新挑战，或者换个对手。";
    outlineText(flavor, 0, 240, 20, "#ebd8c8", WINW/2);
    if ((g_animT%1)<0.65)
      outlineText(isTouch?"点按屏幕 重新挑战":"Z 重新挑战　　ESC 返回主界面", 0, 330, 22, "#fff", WINW/2);
    hot(0,0,WINW,WINH,()=>pressKey("z"));
  }

  // ---- 受伤红闪
  if (g_redFlash>0){
    ctx.strokeStyle=`rgba(255,30,30,${Math.min(1,g_redFlash*260/255)})`;
    ctx.lineWidth=14;
    ctx.strokeRect(0,0,WINW,WINH);
  }
  // ---- 白闪
  if (g_whiteFlash>0){
    ctx.fillStyle=`rgba(255,255,255,${Math.min(1,g_whiteFlash*2.2)*0.78})`;
    ctx.fillRect(0,0,WINW,WINH);
  }
  // ---- 残血狂暴红屏
  if (g_state===ST_ATTACK && g_jevHpShown && g_jevHp<Boss().maxhp*0.25){
    const rage=0.5+0.5*Math.sin(g_animT*6);
    ctx.fillStyle=`rgba(255,20,40,${(26+22*rage)/255})`;
    ctx.fillRect(0,0,WINW,WINH);
  }
  // ---- CRT 覆盖层
  ctx.drawImage(GetCrt(), 0, 0, WINW, WINH);

  // ---- 暂停按钮（战斗中右上角）
  if (g_state>=ST_INTRO && g_state!==ST_WIN && g_state!==ST_LOSE){
    btnPause();
  }

  // ---- 操作提示
  if (g_state===ST_MENU && !isTouch)
    outlineText("方向键选择  Z确认  X取消", 12, 10, 15, "#b4d2ff", -1, false);
}

function btnPause(){
  const x=WINW-44, y=10, w=34, h=30;
  ctx.fillStyle="rgba(20,14,40,0.6)";
  ctx.strokeStyle="rgba(200,200,255,0.5)"; ctx.lineWidth=1.5;
  roundRect(x,y,w,h,7); ctx.fill(); ctx.stroke();
  ctx.fillStyle="rgba(240,240,255,0.9)";
  ctx.fillRect(x+10,y+7,4,h-14); ctx.fillRect(x+20,y+7,4,h-14);
  hot(x-8,y-8,w+16,h+16,()=>{
    g_pauseFrom=g_state; g_pauseSel=0; g_state=ST_PAUSE; playSfx("snd_menu_move");
  });
}

// ---- 预警图形（每个招式）
function renderWarn(pulse){
  switch (g_pattern){
  case P_CAROUSEL:
    for (let i=0;i<3;++i){
      const rr=(34+i*34)*(1+0.12*pulse);
      ctx.strokeStyle=`rgba(255,210,120,${(90+90*pulse)/255})`;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(BOX_CX,BOX_CY,rr,rr*0.52,0,0,6.29); ctx.stroke();
    }
    break;
  case P_RAIN: {
    const rn = img(g_boss===0?"diamond":"mail");
    if (rn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<5;++i){
        const x=BOX_X0+40+i*(BOX_X1-BOX_X0-80)/4;
        const y=BOX_Y0+26+Math.sin(g_animT*9+i)*6;
        drawImg(rn,x,y,26,26,g_animT*120);
      } ctx.restore(); }
    break; }
  case P_KNIVES: {
    ctx.strokeStyle=`rgba(255,60,60,${(150+100*pulse)/255})`;
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(BOX_X0+4,g_heartY); ctx.lineTo(BOX_X1-4,g_heartY);
    ctx.moveTo(g_heartX,BOX_Y0+4); ctx.lineTo(g_heartX,BOX_Y1-4);
    ctx.stroke();
    const kn=img("knife");
    if (kn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(kn,BOX_X0+26,g_heartY,40,40,90);
      drawImg(kn,BOX_X1-26,g_heartY,40,40,-90);
      drawImg(kn,g_heartX,BOX_Y0+26,40,40,180);
      drawImg(kn,g_heartX,BOX_Y1-26,40,40,0);
      ctx.restore(); }
    break; }
  case P_DEAL: {
    const cn=img("coin");
    if (cn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<4;++i){
        const ax=(i&1)?BOX_X1-30:BOX_X0+30, ay=(i&2)?BOX_Y1-30:BOX_Y0+30;
        const k2=(g_animT*1.6+i*0.25)%1;
        drawImg(cn, ax+(BOX_CX-ax)*k2*0.4, ay+(BOX_CY-ay)*k2*0.4, 28,28, g_animT*300);
      } ctx.restore(); }
    ctx.strokeStyle=`rgba(255,230,160,${(90+100*pulse)/255})`;
    ctx.lineWidth=2;
    ctx.strokeRect(BOX_X0,BOX_Y0,BOX_X1-BOX_X0,BOX_Y1-BOX_Y0);
    break; }
  case P_CALL: {
    for (let i=0;i<6;++i){
      const x=BOX_X0+30+i*(BOX_X1-BOX_X0-60)/5;
      ctx.strokeStyle=`rgba(120,255,160,${(60+120*Math.sin(g_animT*8+i))/255})`;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x,BOX_Y0+6); ctx.lineTo(x,BOX_Y1-6); ctx.stroke();
    }
    const ph=img("phone");
    if (ph){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(ph,BOX_CX,BOX_CY-26,34,34,Math.sin(g_animT*22)*14); ctx.restore(); }
    break; }
  case P_KROMER: {
    const cn=img("coin");
    if (cn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<8;++i){
        const a=g_animT*2.2+i*0.785;
        drawImg(cn, BOX_CX+Math.cos(a)*120, BOX_CY+Math.sin(a)*58, 26,26, g_animT*240);
      } ctx.restore(); }
    break; }
  case P_CRUSHER: {
    ctx.strokeStyle=`rgba(255,150,150,${(140+110*pulse)/255})`;
    ctx.lineWidth=3;
    const inn=26+pulse*10;
    ctx.beginPath();
    ctx.moveTo(BOX_X0+inn,BOX_Y0+8); ctx.lineTo(BOX_X0+inn,BOX_Y1-8);
    ctx.moveTo(BOX_X1-inn,BOX_Y0+8); ctx.lineTo(BOX_X1-inn,BOX_Y1-8);
    ctx.stroke();
    const bn=img("bomb");
    if (bn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<3;++i){
        const y=BOX_Y0+30+i*(BOX_Y1-BOX_Y0-60)/2;
        drawImg(bn,BOX_X0+inn-20,y,26,26,0);
        drawImg(bn,BOX_X1-inn+20,y,26,26,0);
      } ctx.restore(); }
    break; }
  case P_CHAIN: {
    for (let i=0;i<2;++i){
      const rr=(54+i*52)*(1+0.08*pulse);
      ctx.strokeStyle=`rgba(255,120,200,${(90+90*pulse)/255})`;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(BOX_CX,BOX_CY,rr,rr*0.52,0,0,6.29); ctx.stroke();
    }
    const hn=img("heart");
    if (hn){ ctx.save(); ctx.imageSmoothingEnabled=false; drawImg(hn,BOX_CX,BOX_CY,34,34,0); ctx.restore(); }
    break; }
  case P_BOMB: {
    const bn=img("bomb");
    const sc=40+16*pulse;
    if (bn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(bn,BOX_CX,BOX_CY,sc,sc,g_animT*90); ctx.restore(); }
    ctx.strokeStyle=`rgba(255,90,60,${(160+90*pulse)/255})`;
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(BOX_X0+6,BOX_CY); ctx.lineTo(BOX_X1-6,BOX_CY);
    ctx.moveTo(BOX_CX,BOX_Y0+6); ctx.lineTo(BOX_CX,BOX_Y1-6);
    ctx.stroke();
    break; }
  case P_LASER:
    for (let i=0;i<3;++i){
      const y=BOX_Y0+34+i*(BOX_Y1-BOX_Y0-68)/2;
      const a=0.25+0.3*Math.sin(g_animT*16+i);
      ctx.strokeStyle=`rgba(255,90,120,${a})`;
      ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(BOX_X0+2,y); ctx.lineTo(BOX_X1-2,y); ctx.stroke();
    }
    break;
  case P_MAGIC: {
    const N=4, step=(BOX_Y1-BOX_Y0-30)/(N-1);
    const gap=Math.floor(g_animT*1.6)%N;
    const wc=img("whitecat");
    for (let i=0;i<N;++i){
      const y=BOX_Y0+15+i*step;
      if (i===gap){
        ctx.strokeStyle=`rgba(255,250,250,${(120+120*pulse)/255})`;
        ctx.lineWidth=2.5;
        const ax=BOX_X1-34;
        ctx.beginPath();
        ctx.moveTo(ax,y); ctx.lineTo(ax+16,y);
        ctx.moveTo(ax+16,y); ctx.lineTo(ax+10,y-6);
        ctx.moveTo(ax+16,y); ctx.lineTo(ax+10,y+6);
        ctx.stroke();
      } else if (wc){
        ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(wc,BOX_X1-22,y,27,27,0); ctx.restore();
      }
    }
    break; }
  case P_LOVE: {
    ctx.strokeStyle=`rgba(255,140,190,${(150+100*pulse)/255})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(BOX_CX-30,BOX_CY); ctx.lineTo(BOX_CX-14,BOX_CY);
    ctx.moveTo(BOX_CX+14,BOX_CY); ctx.lineTo(BOX_CX+30,BOX_CY);
    ctx.moveTo(BOX_CX,BOX_CY-24); ctx.lineTo(BOX_CX,BOX_CY-10);
    ctx.moveTo(BOX_CX,BOX_CY+10); ctx.lineTo(BOX_CX,BOX_CY+24);
    ctx.stroke();
    const cb=img("catbomb");
    if (cb){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(cb,BOX_CX,BOX_CY+34+Math.sin(g_animT*5)*4,32,32,g_animT*60);
      drawImg(cb,BOX_CX-46,BOX_CY-20+Math.cos(g_animT*4)*4,24,24,-g_animT*50);
      drawImg(cb,BOX_CX+46,BOX_CY-20-Math.cos(g_animT*4)*4,24,24,g_animT*50);
      ctx.restore(); }
    break; }
  case P_MEOW: {
    const side=[[-1,0],[1,0],[0,-1],[0,1]];
    const pn=img("paw");
    if (pn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<4;++i){
        const x=BOX_CX+side[i][0]*(60+18*pulse);
        const y=BOX_CY+side[i][1]*(44+14*pulse);
        drawImg(pn,x,y,32,32,Math.atan2(side[i][1],side[i][0])*57.3+90);
      } ctx.restore(); }
    break; }
  case P_GHOST: {
    const gn=img("ghost");
    if (gn){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<4;++i){
        const a=g_animT*1.8+i*1.5708;
        drawImg(gn,BOX_CX+Math.cos(a)*128,BOX_CY+Math.sin(a)*60,32,32,0);
      } ctx.restore(); }
    break; }
  default: {  // 梅花喷泉
    const sp=img("sparkle"), cl=img("club");
    if (sp){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(sp,BOX_CX,BOX_CY,54+12*pulse,54+12*pulse,g_animT*260); ctx.restore(); }
    if (cl){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<4;++i){
        const a=g_animT*3+i*1.57;
        drawImg(cl,BOX_CX+Math.cos(a)*54,BOX_CY+Math.sin(a)*40,24,24,a*57.3);
      } ctx.restore(); }
    break; }
  }
}

// ---------------- 主循环 ----------------
const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints>0;
let lastT = performance.now();
function loop(now){
  let dt=(now-lastT)/1000;
  lastT=now;
  if (dt>0.05) dt=0.05;
  Update(dt);
  Render();
  requestAnimationFrame(loop);
}

// 资源加载完成 → 进入主界面
loadFinishCb = ()=>{
  document.getElementById("loading").style.display="none";
  GoTitle();
  playVoice("Jevil_voiceclip_CHAOS.wav");
  requestAnimationFrame(t=>{ lastT=t; loop(t); });
};
// 若音频事件不触发（缓存），兜底检查
setTimeout(function poll(){
  if (loadFinishCb && loadDone>=loadTotal){ loadFinishCb(); loadFinishCb=null; }
  else if (loadFinishCb) setTimeout(poll, 300);
}, 500);
