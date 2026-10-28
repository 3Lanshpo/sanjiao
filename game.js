// =====================================================================
//  小丑魔战斗 网页版 —— 由 C++/Win32 版完整移植
//  HTML5 Canvas + Web Audio，支持手机触屏操作
// =====================================================================
'use strict';

// ---------------- 常量 ----------------
let WINW = 640, WINH = 480;      // 舞台逻辑尺寸：随屏幕比例扩展（横屏加宽/竖屏加高）
let VOX = 0, VOY = 0;            // 640x480 游戏场景在舞台中的偏移
const BOX_X0 = 120, BOX_Y0 = 278, BOX_X1 = 520, BOX_Y1 = 418;
const BOX_CX = (BOX_X0 + BOX_X1) * 0.5, BOX_CY = (BOX_Y0 + BOX_Y1) * 0.5;
const JEV_CX = 320, JEV_CY = 140;
const HEART_SPD = 185.0;
const PLAYER_MAXHP = 120.0;

// 状态
const ST_TITLE=0, ST_PAUSE=1, ST_INTRO=2, ST_MENU=3, ST_SUB=4,
      ST_FIGHT=5, ST_DMG=6, ST_DIALOG=7, ST_ATTACK=8, ST_WIN=9, ST_LOSE=10,
      ST_WAIT=11;                     // 联机：我已出刀，等队友出刀
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
  patLine:["All-Star Cast！星星穿板！","Smash Cut！屏幕切开！","Rimshot！反弹星星！","信号波！蛇行穿插！"],
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
  pat:[P_MAGIC,P_LOVE,P_MEOW,P_GHOST], patW:1.30,
  line:["喵～人家一直想见你哦！","可爱就是正义！喵！",
        "这个身体……完美吧？喵哈哈！","不许躲开人家的爱！","再来一次！Cutie Revolution！"],
  patLine:["三车道猫冲锋！接住爱心！喵！","喵喵炸弹！十字光波！","4x4 炸弹格！整行整列爆！","雷达圈！别被扫到！喵！"],
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
let g_sliceT=0, g_chainN=0;                    // Tenna 切屏特效 / 闪电连击数
let g_gridWarn=[];                             // Pink 炸弹格：待引爆的格子
let g_dead=false, g_deadChoice=false, g_deadSel=0;   // 联机阵亡 / 是否已选择「观战」
let g_actionKind="", g_actionDmg=0;            // 本回合行动（用于同步给队友）
let g_pauseUI=false;                           // 联机暂停：只开面板，不冻结游戏
let g_sliceCv=null, g_sliceCtx=null;           // 切屏后处理用的临时画布
let g_hbMs=45;                                 // 弹幕阶段传心位置的间隔（公共 broker 高频会丢包，实测调）

// ---------------- 联机（MQTT 公共 broker，免注册） ----------------
const NET_BASE = "sanjiao-boss-v1";
// 公共 broker：hivemq 实测最稳（RTT 220ms 上下、抖动极小）。两端必须连同一个，
// 所以不做自动换 broker（换了会互相看不见），连不上就重连同一个。
const NET_URLS = ["wss://broker.hivemq.com:8884/mqtt"];
const NET_WSS  = NET_URLS[0];
const net = {
  on:false, cli:null, cid:"", name:"",
  role:"",                 // "" | "leader" | "member"
  partner:"", partnerName:"", teamTopic:"",
  players:new Map(),       // cid -> {n, s, ts}
  selIdx:0, panel:false,
  invite:null,             // 收到的邀请 {from, n, ts}
  invSent:0,               // 已发出邀请 cid（等待回应）
  lastPre:0, lastFlush:0, lastHb:0,
  lastState:-1, bid:0, bidSent:0, px:undefined, py:undefined, php:undefined, pseen:0,
  dpx:undefined, dpy:undefined, pvx:0, pvy:0, ppseen:0,   // 队友心的平滑显示坐标 + 速度估计
  clkMin:undefined, hbLag:0,                              // 单程延迟基线（最小RTT法）/ 平滑后的当前延迟
  rtt:0, pingT:0,                                         // ping/pong 往返（只用自己的时钟，不受两端时钟偏差影响）
  retryAt:0,                                              // 上次重连时间（防抖）
  pc:null, dc:null, dcOk:false, rtcT:0, pendCand:[], answering:false,   // WebRTC 直连（P2P，低延迟）
  rtcId:0, lastOfferId:0,                                 // 信令去重（offer 会重发，重复的不能重建连接）
  pTs:0, bTs:0,                                           // 已处理的最新 hb / bf 时间戳（双路去重）
  myAct:false, pAct:false, pActPending:false,              // 本回合：我 / 队友 是否已行动
  actSeen:"",                                              // act 去重键（QoS 重发只算一次）
  pDead:false,                                             // 队友是否已阵亡
  startNo:0,                                               // 开战序号（队长递增 / 队员记录已应用的那个）
  loseAt:0, seenSb:new Set(), lostSince:0, leftAt:0,
};
try {
  // 身份按标签页隔离：同一浏览器开多个窗口/标签各算一个玩家（放 localStorage 会共用一个 cid，
  // 两个窗口会互相忽略对方，导致在线人数永远是 1、也无法互邀）
  let cid = null;
  try { cid = sessionStorage.getItem("sj_cid"); } catch(e){}
  if (!cid){
    cid = "sj"+Math.random().toString(36).slice(2,10);
    try { sessionStorage.setItem("sj_cid", cid); } catch(e){}
  }
  net.cid = cid;
  net.inst = Math.random().toString(36).slice(2,8);   // 本次加载的实例号，用于识别「复制标签页」撞号
  net.name = localStorage.getItem("sj_name") ||
    ("玩家-"+Math.random().toString(36).slice(2,5).toUpperCase());
  localStorage.setItem("sj_name", net.name);
} catch(e){ net.cid="sj"+Math.random().toString(36).slice(2,10); net.name="玩家-?"; }

function netPub(topic, obj, qos){
  if (!net.on || !net.cli) return;
  try { net.cli.publish(topic, JSON.stringify(obj), {qos:qos||0}); } catch(e){}
}
function netPubRetry(topic, obj, times){                 // 关键消息：QoS1 + 重发
  netPub(topic, obj, 1);
  for (let i=1;i<(times||3);++i)
    setTimeout(()=>netPub(topic, obj, 1), i*350);
}
function netRole(){ return net.role; }
function isMember(){ return net.role==="member"; }
function isLeader(){ return net.role==="leader"; }

// ---------------- WebRTC 直连（P2P） ----------------
// MQTT 公共 broker 要绕到境外，单程 200~400ms，打弹幕根本跟不上。
// 组队后用 MQTT 做信令建立 DataChannel，之后位置/子弹走 P2P（同城 20~60ms，同机 <5ms），
// MQTT 仍然双发兜底，直连失败就退回原来的中转方案。
const RTC_ICE = { iceServers:[
  {urls:["stun:stun.qq.com:3478","stun:stun.miwifi.com:3478","stun:stun.l.google.com:19302"]}
]};
function netRtcClose(){
  try { net.dc && net.dc.close(); } catch(e){}
  try { net.pc && net.pc.close(); } catch(e){}
  net.dc=null; net.pc=null; net.dcOk=false; net.pendCand.length=0; net.rtcT=0; net.answering=false;
  net.rtt=0;                                  // 直连断了 → 重新量延迟
}
function netRtcBindDc(dc){
  net.dc=dc;
  dc.onopen=()=>{ net.dcOk=true; net.rtt=0; Say("已建立直连（低延迟）"); };
  dc.onclose=()=>{ if (net.dc===dc){ net.dcOk=false; net.dc=null; net.rtt=0; } };
  dc.onmessage=ev=>{
    let m; try { m=JSON.parse(ev.data); } catch(e){ return; }
    m.__dc=1;                                     // 标记来源：ping 从哪来就从哪回，RTT 才不被中转延迟污染
    netTeamMsg(m);
  };
}
function netRtcSend(obj, qos, times){
  const s=JSON.stringify(obj);
  if (net.dc && net.dc.readyState==="open"){ try { net.dc.send(s); } catch(e){} }
  if (!net.teamTopic) return;
  if (times && times>1) netPubRetry(net.teamTopic, obj, times);
  else netPub(net.teamTopic, obj, qos||0);
}
function netRtcStart(){                          // 队长发起
  if (!isLeader() || !net.teamTopic) return;
  if (net.dcOk) return;
  if (net.pc && Date.now()-(net.rtcT||0) < 7000) return;   // 正在协商，别重启
  try {
    netRtcClose();
    const pc=new RTCPeerConnection(RTC_ICE);
    net.pc=pc; net.rtcT=Date.now();
    net.rtcId=Date.now() + Math.floor(Math.random()*1000);   // 每次协商唯一（跨会话也不会撞）
    const rid=net.rtcId;
    netRtcBindDc(pc.createDataChannel("g",{ordered:true}));
    pc.onicecandidate=e=>{ if (e.candidate) netRtcSend({t:"rtc",k:"c",from:net.cid,id:rid,c:e.candidate.toJSON()}); };
    pc.onconnectionstatechange=()=>{
      if (pc.connectionState==="failed"||pc.connectionState==="closed") netRtcDown();
    };
    pc.createOffer()
      .then(o=>pc.setLocalDescription(o))
      .then(()=>netRtcSend({t:"rtc",k:"o",from:net.cid,id:rid,sdp:pc.localDescription},1,3))
      .catch(()=>{});
  } catch(e){ netRtcDown(); }
}
function netRtcDown(){ netRtcClose(); }
async function netRtcOnSignal(m){
  try {
    if (m.k==="hello"){                           // 队员订阅好了 → 队长现在可以发 offer
      if (isLeader()) netRtcStart();
    } else if (m.k==="o" && isMember()){           // 队员：收到 offer
      if (m.id && m.id===net.lastOfferId){         // 同一个 offer 的重发：已经答过了，别再重建
        if (net.pc && net.pc.localDescription)
          netRtcSend({t:"rtc",k:"a",from:net.cid,id:m.id,sdp:net.pc.localDescription},1,0);
        return;
      }
      net.lastOfferId=m.id||0;
      netRtcClose();
      const pc=new RTCPeerConnection(RTC_ICE);
      net.pc=pc; net.rtcT=Date.now();
      const rid=m.id||0;
      pc.ondatachannel=e=>netRtcBindDc(e.channel);
      pc.onicecandidate=e=>{ if (e.candidate) netRtcSend({t:"rtc",k:"c",from:net.cid,id:rid,c:e.candidate.toJSON()}); };
      pc.onconnectionstatechange=()=>{
        if (pc.connectionState==="failed"||pc.connectionState==="closed") netRtcDown();
      };
      await pc.setRemoteDescription(m.sdp);
      for (const c of net.pendCand.splice(0)) { try { await pc.addIceCandidate(c); } catch(e){} }
      const a=await pc.createAnswer();
      await pc.setLocalDescription(a);
      netRtcSend({t:"rtc",k:"a",from:net.cid,id:rid,sdp:pc.localDescription},1,3);
    } else if (m.k==="a" && isLeader() && net.pc && !net.pc.currentRemoteDescription){
      if (m.id && net.rtcId && m.id!==net.rtcId) return;   // 旧 offer 的应答，丢掉
      if (net.answering) return;                           // 并发到达的重复 answer
      net.answering=true;
      try { await net.pc.setRemoteDescription(m.sdp); }
      finally { net.answering=false; }
      for (const c of net.pendCand.splice(0)) { try { await net.pc.addIceCandidate(c); } catch(e){} }
    } else if (m.k==="c"){
      if (m.id && net.rtcId && isLeader() && m.id!==net.rtcId) return;
      if (!net.pc || !net.pc.remoteDescription){ net.pendCand.push(m.c); if (net.pendCand.length>40) net.pendCand.shift(); }
      else { try { await net.pc.addIceCandidate(m.c); } catch(e){} }
    }
  } catch(e){ try{ console.warn("rtc-signal", e&&e.message||e); }catch(_){} }
}

function netConnect(){
  if (typeof mqtt==="undefined") return;           // CDN 加载失败 → 离线单人
  const url = NET_URLS[0];
  try {
    net.cli = mqtt.connect(url, {
      clientId:"sjc_"+net.cid+"_"+Math.random().toString(36).slice(2,6),
      clean:true, keepalive:30, reconnectPeriod:4000, connectTimeout:8000 });
    net.cli.on("connect", ()=>{
      net.on=true; net.retryAt=0;
      net.cli.subscribe([NET_BASE+"/p/#", NET_BASE+"/i/"+net.cid, NET_BASE+"/t/"+net.cid], ()=>{});
    });
    net.cli.on("close", ()=>{ net.on=false; });
    net.cli.on("error", ()=>{ netRetryConnect(); });
    net.cli.on("message", (topic, payload)=>{
      let m; try { m=JSON.parse(payload.toString()); } catch(e){ return; }
      netMsg(topic, m);
    });
    setTimeout(()=>{ if (!net.on) netRetryConnect(); }, 9000);
  } catch(e){ net.on=false; netRetryConnect(); }
}
function netRetryConnect(){                          // 连不上就重连同一个 broker（换 broker 会导致两端互相看不见）
  if (net.on) return;
  const now=Date.now();
  if (net.retryAt && now-net.retryAt<8000) return;   // 别堆定时器
  net.retryAt=now;
  try { net.cli && net.cli.end(true); } catch(e){}
  net.on=false;
  setTimeout(()=>{ net.retryAt=0; if (!net.on) netConnect(); }, 2500);
}
function netMsg(topic, m){
  if (topic.startsWith(NET_BASE+"/p/")){                 // presence
    const cid=topic.slice(NET_BASE.length+3);
    if (cid===net.cid){
      if (m.i && net.inst && m.i!==net.inst) netRerollId();   // 复制标签页 → 身份撞车，换一个
      return;
    }
    net.players.set(cid, {n:m.n||"???", s:m.s||"lobby", ts:Date.now()});
    if (net.partner && cid===net.partner){
      net.partnerName=m.n;
      // bye 消息可能丢：对方的 presence 从 team/battle 变回 lobby 才算真退队。
      // （组队刚成立时收到的第一条可能还是他几秒前发的旧 lobby 包，不能当退队）
      if (m.s==="lobby"){
        if (net.pS && net.pS!=="lobby") net.lostSince = net.lostSince || Date.now();
      } else { net.lostSince=0; net.pS=m.s; }
    }
    return;
  }
  if (topic===NET_BASE+"/i/"+net.cid){                   // 发给我的邀请/回应
    if (m.t==="inv"){
      if (!net.role && (!net.invite || Date.now()-net.invite.ts>6000))
        net.invite={from:m.from, n:m.n, ts:Date.now()};
      else if (net.role) netPub(NET_BASE+"/i/"+m.from, {t:"busy"});
    } else if (m.t==="acc"){ netTeamForm(m.from, m.n); }
    else if (m.t==="rej"){ if (net.invSent===m.from){ net.invSent=0; Say(m.n+" 拒绝了组队邀请"); } }
    else if (m.t==="busy"){ if (net.invSent===m.from){ net.invSent=0; Say(m.n+" 正在组队中"); } }
    else if (m.t==="ok"){                                // 队长确认 → 我是队员
      if (net.leftAt && Date.now()-net.leftAt<6000) return;  // 刚退出，忽略迟到的确认
      if (net.role==="member" && net.partner===m.leader) return;   // QoS 重发的重复包：别覆盖当前字幕/状态
      net.role="member"; net.partner=m.leader; net.partnerName=m.n; net.lostSince=0; net.leftAt=0;
      net.teamTopic=NET_BASE+"/t/"+m.leader;
      net.invite=null; net.invSent=0; net.panel=false;
      net.pTs=0; net.bTs=0;
      net.cli.subscribe(net.teamTopic, ()=>{});
      // 原来正在单人挑战（或刚结算完）→ 先退出这场，等着队长开；否则 start 会被当成「已在战斗中」忽略
      if (g_state!==ST_TITLE){
        g_dead=false; g_deadChoice=false; g_deadSel=0; g_pauseUI=false; g_sub=SM_NONE;
        GoTitle();
      }
      Say("已与 "+m.n+" 组队！TA 是队长（红心），按 Enter 退出组队");
      setTimeout(()=>{ if (isMember() && net.partner===m.leader)
        netPub(net.teamTopic, {t:"rtc", k:"hello", from:net.cid}); }, 250);
    }
    return;
  }
  if (net.teamTopic && topic===net.teamTopic){ netTeamMsg(m); }
}
// 队长收到同意 → 组队成立
function netTeamForm(cid, name){
  if (net.role || (net.invSent && net.invSent!==cid)) return;
  net.role="leader"; net.partner=cid; net.partnerName=name; net.lostSince=0; net.leftAt=0;
  net.teamTopic=NET_BASE+"/t/"+net.cid;
  net.invSent=0; net.panel=false; net.pTs=0; net.bTs=0;
  net.cli.subscribe(net.teamTopic, ()=>{});
  netPubRetry(NET_BASE+"/i/"+cid, {t:"ok", leader:net.cid, n:net.name}, 3);
  Say("已与 "+name+" 组队！你是队长（红心），选择 Boss 后 TA 会一起挑战");
  setTimeout(()=>{ if (isLeader() && net.partner===cid) netRtcStart(); }, 900);   // 等对方订阅好再发 offer
}
// 队友心位置：记录速度用于帧间外推。
// ts = 队友发包时的墙钟。用「最小单程延迟」当基线，自动吃掉两端时钟偏差，
// 剩下的就是这一包真正多花的时间 → 显示时可以整段前推掉，蓝心才不会慢半拍。
function netPartnerHeart(x, y, ts){
  if (ts && net.pTs && ts < net.pTs) return;     // 双路/旧快照：别把心往回拉
  if (ts) net.pTs=ts;
  const now=Date.now();
  if (ts){
    const d=now-ts;
    if (d>=0 && d<3000){
      if (net.clkMin===undefined || d<net.clkMin) net.clkMin=d;
      const raw=clamp(d-net.clkMin, 0, 400);
      net.hbLag = net.hbLag ? net.hbLag*0.72+raw*0.28 : raw;
    }
  }
  if (net.px!==undefined && net.ppseen){
    const dtp=(now-net.ppseen)/1000;
    if (dtp>0.012 && dtp<0.6){
      const nvx=clamp((x-net.px)/dtp, -680, 680);
      const nvy=clamp((y-net.py)/dtp, -680, 680);
      net.pvx=net.pvx*0.35+nvx*0.65;     // 平滑速度：高频采样下别把抖动放大
      net.pvy=net.pvy*0.35+nvy*0.65;
    }
  } else { net.dpx=x; net.dpy=y; net.pvx=0; net.pvy=0; net.hbLag=0; }
  net.px=x; net.py=y; net.ppseen=now; net.pseen=now;
}
// 每帧推进：位置点会随每个心跳小幅跳变（一包一跳 → 看着一顿一顿）
// 所以这里不追「点」，而是让「速度连续」：按估计速度前进，再用位置误差做比例纠偏
function netSmoothTick(dt){
  if (net.px===undefined){ net.dpx=undefined; return; }
  // 队友已阵亡（观战）→ 不画他的心。注意别走下面的钳制，否则 -999 会被慢慢拉到框左边缘
  if (net.pDead || net.px<-900){ net.dpx=-999; net.dpy=-999; net.pvx=0; net.pvy=0; return; }
  if (net.dpx===undefined){ net.dpx=net.px; net.dpy=net.py; }
  const age=Math.min(0.30, (Date.now()-(net.ppseen||0))/1000);
  // 单程延迟估计：ping/pong 的 RTT/2（不受时钟偏差影响）与这包「发出→收到」的最小耗时
  const srtt=Math.min(0.30, Math.min((net.rtt||0)/2000, (net.clkMin||0)/1000));
  // hbLag 是毫秒（这包比最快那包多花的时间），换算成秒再前推；原来少除了 1000，
  // 导致前推恒定多出 140ms —— 蓝心一直「超前一大段」还带一顿一顿
  const jit=Math.min(0.14, (net.hbLag||0)*0.0006);
  const lead=Math.min(0.46, age+srtt+jit);
  let vx=net.pvx, vy=net.pvy;
  if (age>0.20){ const bleed=Math.exp(-dt*9); vx*=bleed; vy*=bleed; }   // 心跳断了：速度自然衰减，别一直飘
  const tx=clamp(net.px+vx*lead, BOX_X0+16, BOX_X1-16);
  const ty=clamp(net.py+vy*lead, BOX_Y0+16, BOX_Y1-16);
  const ex=tx-net.dpx, ey=ty-net.dpy;
  if (Math.hypot(ex,ey)>70){                      // 刚开回合/掉包落后太多：先快速归位
    const k=Math.min(1, dt*20);
    net.dpx+=ex*k; net.dpy+=ey*k;
  } else {
    const kp=11;                                  // 位置纠偏增益（1/s）：~90ms 把误差吃掉
    let ax=vx+ex*kp, ay=vy+ey*kp;
    const sp=Math.hypot(ax,ay), cap=700;
    if (sp>cap){ ax*=cap/sp; ay*=cap/sp; }
    net.dpx+=ax*dt; net.dpy+=ay*dt;
  }
}
// 组队频道消息
function netTeamMsg(m){
  if (m.from===net.cid) return;
  if (m.t==="rtc"){ netRtcOnSignal(m); return; }        // 直连信令
  if (m.t==="hb"){                                       // 队友心位置+HP（双路到达的旧包由 netPartnerHeart 按 ts 丢弃）
    netPartnerHeart(m.x, m.y, m.ts); net.php=m.hp;
    if (m.d!==undefined) net.pDead=!!m.d;
  } else if (m.t==="ping"){                              // 量单程延迟：只用自己的时钟算 RTT，避免两端时钟偏差
    const o={t:"pong", from:net.cid, ts:m.ts||0};
    if (m.__dc && net.dc && net.dc.readyState==="open"){ try { net.dc.send(JSON.stringify(o)); } catch(e){} }
    else netPub(net.teamTopic, o, 0);
  } else if (m.t==="pong"){
    if (m.ts && net.pongTs===m.ts) return;               // 直连+中转两份应答：只认先到的
    net.pongTs=m.ts;
    const r=Date.now()-(m.ts||0);
    if (r>=0 && r<2000) net.rtt = net.rtt ? net.rtt*0.68+r*0.32 : r;
  } else if (m.t==="act"){                               // 队友已出刀/已行动
    if (m.turn!==undefined){
      if (m.turn===g_turn+1 && g_state===ST_ATTACK){ net.pActPending=true; return; }  // 我还在躲弹，下回合生效
      if (m.turn!==g_turn) return;                       // 上一回合的迟到包
    }
    const key=m.from+":"+m.turn+":"+m.kind;
    if (net.actSeen && net.actSeen===key) return;        // 重发包只算一次（否则队长会重复扣血）
    net.actSeen=key;
    if (isLeader() && m.kind==="fight" && m.dmg>0) HitJevil(m.dmg|0);   // 队长权威扣血
    net.pAct=true;
    // 已经出过刀在等队友 → 开打；已经阵亡（观战）且停在菜单里 → 也要继续推进，
    // 否则死掉的那一方会永远卡在菜单，队长不发 atk，活着的人只能干等
    if (net.myAct && (g_state===ST_WAIT || (g_dead && g_state===ST_MENU))) netBothActed();
  } else if (m.t==="pick"){                              // 队友吃掉一颗爱心：本地同步移除，别让它被快照复活
    for (const b of g_bullets) if (b._sid===m.sid){ b.x=-9999; b._taken=true; }
  } else if (m.t==="bye"){                               // 队友退出
    const who=net.partnerName;
    netDisband(false);
    Say(who+" 退出了组队");
  } else if (m.t==="start" && isMember()){               // 队长开战（按开战序号去重，重发/下一场都能正确处理）
    if (m.b!==undefined && m.b===net.startNo) return;    // 同一场战斗的重发
    net.startNo=(m.b!==undefined) ? m.b : net.startNo;
    // 无论自己之前是不是在打（单人挑战 / 上一场的结算画面），一律按队长的这一场重开
    g_pauseUI=false; g_dead=false; g_deadChoice=false;
    StartBattle(m.boss);
  } else if (m.t==="atk" && isMember()){                 // 攻击阶段开始（重发只在未进攻击时应用）
    if (g_state===ST_ATTACK) return;
    net.myAct=false; net.pAct=false;                     // 新回合
    if (m.turn!==undefined) g_turn=m.turn;               // 回合号以队长为准
    g_pattern=m.pat; g_lastPat=m.pat; g_bullets=[]; g_state=ST_ATTACK; g_stateT=0;
    g_spawnT=0; g_fired=true; g_knifeWarn=-1; g_sliceT=0; g_chainN=0; g_waveN=0;
    g_gridWarn.length=0; g_heartX=BOX_CX; g_heartY=BOX_CY;
    Say(m.txt||"");
  } else if (m.t==="st" && isMember()){                  // 状态同步（胜负/台词）
    if (m.s===g_state) return;                           // QoS1 重复消息
    if (m.s===ST_WIN||m.s===ST_LOSE){
      g_state=m.s; g_stateT=0; Say(m.txt||"");
    } else if (m.s===ST_MENU){
      // 我正在结算自己的行动（出刀条/伤害/对话/等队友）时不能被队长的菜单重发打断
      if (g_state===ST_FIGHT||g_state===ST_DMG||g_state===ST_DIALOG||
          g_state===ST_SUB||g_state===ST_WAIT) return;
      if (g_state===ST_ATTACK) g_turn++;                 // 回合号跟队长对齐
      g_state=ST_MENU; g_stateT=0; g_bullets=[]; Say(m.txt||"");
      net.myAct=false; net.pAct=false;
      if (net.pActPending){ net.pActPending=false; net.pAct=true; }
    }
    else if (m.s===ST_INTRO){ if (g_state!==ST_INTRO) ResetGame(); }   // 幂等：迟到的重复包不再重置
    else if (m.s===ST_TITLE){ if (g_state!==ST_TITLE) GoTitle(); }
  } else if (m.t==="bf" && isMember()){                  // 子弹场全量同步（队长权威，丢包自愈）
    if (m.ts && net.bTs && m.ts < net.bTs) return;        // 双路到达的旧快照：丢掉，别让子弹往回跳
    if (m.ts) net.bTs=m.ts;
    const now=performance.now(), dtS=(now-(net.lastBf||now))/1000 || 0.1;
    net.lastBf=now;
    if (m.h){ netPartnerHeart(m.h[0], m.h[1], m.h[3]); net.php=m.h[2]; }
    if (m.bh!==undefined){ net.bh=m.bh; net.bshown=m.bs?1:0;
      g_jevHp=m.bh; if (m.bs) g_jevHpShown=true; }   // boss 血量以队长为准
    if (m.d!==undefined) net.pDead=!!m.d;            // 队友是否已阵亡
    // 招式特效状态（切屏 / 信号墙缺口 / 镰刀预警 / 炸弹格预告）
    if (m.v){
      g_sliceT=m.v[0]; g_waveN=m.v[1]; g_knifeWarn=m.v[2];
      g_warnSide=m.v[3]; g_warnX=m.v[4]; g_warnY=m.v[5];
      g_gridWarn.length=0;
      for (const c of (m.v[6]||[])) g_gridWarn.push({gx:c[0], gy:c[1], t:c[2]});
    }
    const got=new Set();
    for (const e of m.b){
      const sid=e[0]; got.add(sid);
      let hit=null;
      for (let i=0;i<g_bullets.length;++i) if (g_bullets[i]._sid===sid){ hit=g_bullets[i]; break; }
      const fl=e[8]|0;
      const dir=e[11], srotv=e[12]||0;
      const dvx=(dir===0)?1:(dir===1)?-1:0, dvy=(dir===2)?1:(dir===3)?-1:0;
      if (hit){
        if (hit._taken){ hit._see=now; continue; }       // 已经吃掉的爱心：别被快照拉回原位复活
        if (fl&16){ hit.st=true; hit.vx=0; hit.vy=0; }   // 静止光束：不要被抖动估成普通子弹
        else if (hit.type===B_CROSS){
          hit.vx=dvx; hit.vy=dvy;                        // 十字光束的 vx/vy 是「方向」，不能当速度插值
          hit.x=e[2]; hit.y=e[3];
        } else {
          // 两帧差值估速 + 软对齐：8Hz 快照也能画出 60fps 的顺滑移动
          hit.vx=(e[2]-hit.x)/dtS*0.55 + hit.vx*0.45;
          hit.vy=(e[3]-hit.y)/dtS*0.55 + hit.vy*0.45;
          hit.x += (e[2]-hit.x)*0.70;
          hit.y += (e[3]-hit.y)*0.70;
        }
        hit.rot=e[5]; hit.life=e[6]; hit.dmg=e[7]; hit.rotv=srotv; hit._see=now;
      } else {
        g_bullets.push({_sid:sid, _net:1, _bt:now, _see:now,
          type:e[1], x:e[2], y:e[3], r:e[4], rot:e[5], rotv:srotv, life:e[6], dmg:e[7],
          ring:!!(fl&1), bolt:!!(fl&2), pick:!!(fl&4), bounce:!!(fl&8), st:!!(fl&16), tt:0,
          rx:e[9]||0, ry:e[10]||0,
          vx:dvx, vy:dvy, ang:0, w:0, cx:BOX_CX, cy:BOX_CY, phase:0});
      }
    }
    // 队长那边已经没有的子弹，本地移除（直连是可靠有序通道，不用等很久）
    const missMs = net.dcOk ? 150 : 450;
    for (let i=g_bullets.length-1;i>=0;--i){
      const b=g_bullets[i];
      if (b._net && !got.has(b._sid) && now-(b._see||b._bt||0)>missMs) g_bullets.splice(i,1);
    }
  }
}
function netDisband(sendBye){
  const topic=net.teamTopic;
  if (sendBye && topic){
    const b={t:"bye", from:net.cid};
    if (net.dc && net.dc.readyState==="open"){ try { net.dc.send(JSON.stringify(b)); } catch(e){} }
    netPub(topic, b, 1);
  }
  // 立刻退订会丢掉刚发出的 bye，延迟再退
  if (topic && net.cli) setTimeout(()=>{ try{ net.cli.unsubscribe(topic); }catch(e){} }, 700);
  const wasWaiting = (g_state===ST_WAIT);        // 正卡在「等队友出刀」→ 队伍没了就别干等
  netRtcClose();                                  // 关掉直连（bye 已经在上面发走了）
  net.role=""; net.partner=""; net.partnerName=""; net.teamTopic="";
  net.px=undefined; net.php=undefined; net.lostSince=0; net.pseen=0; net.pS="";
  net.myAct=false; net.pAct=false; net.pActPending=false; net.pDead=false;
  net.startNo=0;                                  // 开战序号：队长每开一场 +1，队员按序号去重（重发/重启都靠它）
  net.dpx=undefined; net.dpy=undefined; net.pvx=0; net.pvy=0;
  net.clkMin=undefined; net.hbLag=0; net.rtt=0; net.pingT=0;
  net.pTs=0; net.bTs=0; net.pongTs=0;
  if (wasWaiting && g_state===ST_WAIT){          // 队友退队/掉线 → 立刻继续单打，不卡在等待里
    g_stateT=0; netBothActed();
  }
}
function netRerollId(){                                  // 复制标签页导致身份撞车：换成独立 cid 并重新订阅
  const old=net.cid;
  net.cid="sj"+Math.random().toString(36).slice(2,10);
  net.inst=Math.random().toString(36).slice(2,8);
  try { sessionStorage.setItem("sj_cid", net.cid); } catch(e){}
  if (net.role) netDisband(true);
  net.players.clear(); net.lastPre=0;
  if (net.cli && net.on){
    try {
      net.cli.unsubscribe(NET_BASE+"/i/"+old);
      net.cli.subscribe([NET_BASE+"/i/"+net.cid, NET_BASE+"/t/"+net.cid], ()=>{});
    } catch(e){}
  }
}
function netSendInvite(cid){
  if (net.role){ Say("已经在队伍中了"); return; }
  net.invSent=cid;
  netPub(NET_BASE+"/i/"+cid, {t:"inv", from:net.cid, n:net.name});
  Say("已向 "+(net.players.get(cid)?.n||"对方")+" 发出组队邀请…");
}
function netAcceptInvite(){
  const iv=net.invite; if (!iv) return;
  net.invite=null;
  netPub(NET_BASE+"/i/"+iv.from, {t:"acc", from:net.cid, n:net.name});
  Say("已同意 "+iv.n+" 的组队邀请…");
}
function netDeclineInvite(){
  const iv=net.invite; if (!iv) return;
  net.invite=null;
  netPub(NET_BASE+"/i/"+iv.from, {t:"rej", from:net.cid, n:net.name});
}
function netLeave(){                                     // 队员/队长主动退出
  if (!net.role) return;
  const wasMember=isMember();
  net.leftAt=Date.now();
  netDisband(true);
  netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s:"lobby", ts:Date.now(), i:net.inst});
  Say(wasMember ? "已退出组队" : "队伍已解散");
  if (wasMember && g_state>=ST_INTRO) GoTitle();
}
function netLobbyList(){                                 // 可邀请的在线玩家
  const now=Date.now(), out=[];
  for (const [cid,p] of net.players)
    if (now-p.ts<8000 && p.s==="lobby" && cid!==net.invSent)
      out.push({cid, ...p, n: p.n===net.name ? p.n+"（另一窗口）" : p.n});   // 同名=同浏览器的另一个窗口
  return out;
}
function netOnline(){                                    // 在线人数（含自己）
  const now=Date.now(); let n=1;
  for (const p of net.players.values()) if (now-p.ts<8000) n++;
  return n;
}
function netTick(){
  const nowMs=Date.now();                                // 统一用墙钟：与 net.loseAt / leftAt 同源
  if (!net.on) return;
  // presence 心跳
  if (nowMs-net.lastPre>2500){
    net.lastPre=nowMs;
    const s = net.role ? (g_state===ST_ATTACK?"battle":"team") : "lobby";
    netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s, ts:nowMs, i:net.inst});
    for (const [cid,p] of net.players)                   // 清理过期玩家
      if (nowMs-p.ts>9000){
        net.players.delete(cid);
        if (net.role && cid===net.partner){
          const nm=net.partnerName;
          netDisband(false); Say(nm+" 已离线，队伍解散");
        }
      }
  }
  // 组队频道同步
  if (!net.role) return;
  if (net.lostSince && nowMs-net.lostSince>2200){        // 队友 presence 已回大厅且迟迟没回来 → 解散
    const nm=net.partnerName;
    netDisband(false); Say(nm+" 已退出组队");
    return;
  }
  const topic=net.teamTopic;
  // 每秒量一次往返延迟：蓝心的前推补偿靠这个值（只走一条路，别让中转的慢包污染 RTT）
  if (nowMs-(net.pingT||0)>1100){
    net.pingT=nowMs;
    const o={t:"ping", from:net.cid, ts:nowMs};
    let sent=false;
    if (net.dcOk && net.dc && net.dc.readyState==="open"){ try { net.dc.send(JSON.stringify(o)); sent=true; } catch(e){} }
    if (!sent) netPub(topic, o, 0);
  }
  // 双方都发自己的心位置：队员看红心、队长看蓝心都要跟手。
  // 弹幕阶段 18Hz（直连时 30Hz），其余时间 7Hz。直连通了只走 P2P，MQTT 每 400ms 兜底。
  const hbGap = (g_state===ST_ATTACK && !g_dead) ? (net.dcOk ? Math.min(g_hbMs,34) : g_hbMs) : 140;
  if ((isMember() || isLeader()) && nowMs-net.lastHb>hbGap){
    net.lastHb=nowMs;
    const o={t:"hb", from:net.cid, ts:nowMs,
      x:g_dead?-999:Math.round(g_heartX), y:g_dead?-999:Math.round(g_heartY),
      hp:Math.round(g_hp), d:g_dead?1:0};
    if (net.dcOk && net.dc && net.dc.readyState==="open"){
      try { net.dc.send(JSON.stringify(o)); } catch(e){}
      if (nowMs-(net.lastHbMq||0)>400){ net.lastHbMq=nowMs; netPub(topic, o, 0); }
    } else netPub(topic, o, 0);
  }
  const bfGap = net.dcOk ? 40 : 125;                     // 直连 25Hz（队员眼里才是 60fps 的弹幕），中转 8Hz
  if (nowMs-net.lastFlush > Math.min(bfGap,125)){
    net.lastFlush=nowMs;
    if (isLeader()){
      // 全量子弹场：直连 25Hz / 中转 8Hz 广播（丢包也不会不同步，下一个包就恢复）
      if (nowMs-(net.lastBfPub||0) > bfGap){
        net.lastBfPub=nowMs;
        const arr=[];
        for (const b of g_bullets){
          if (b._sid===undefined) b._sid=++net.bid;
          const fl=(b.ring?1:0)|(b.bolt?2:0)|(b.pick?4:0)|(b.bounce?8:0)|
                   ((b.life>0 && !b.ring && b.vx===0 && b.vy===0) ? 16 : 0);
          const dir = (b.type===B_CROSS) ? (b.vx>0?0:b.vx<0?1:b.vy>0?2:3) : -1;
          arr.push([b._sid, b.type, Math.round(b.x), Math.round(b.y), b.r,
                    Math.round(b.rot*100)/100, Math.round((b.life||0)*100)/100,
                    b.dmg|0, fl, b.rx?1:0, b.ry?1:0, dir,
                    Math.round((b.rotv||0)*100)/100]);
          if (arr.length>=140) break;
        }
        const o={t:"bf", from:net.cid, ts:nowMs,
          h:[g_dead?-999:Math.round(g_heartX), g_dead?-999:Math.round(g_heartY), Math.round(g_hp), nowMs],
          bh:Math.round(g_jevHp), bs:g_jevHpShown?1:0, d:g_dead?1:0,
          v:[Math.round(g_sliceT*100)/100, g_waveN, Math.round(g_knifeWarn*100)/100,
             g_warnSide, Math.round(g_warnX), Math.round(g_warnY),
             g_gridWarn.map(w=>[w.gx, w.gy, Math.round(w.t*100)/100])],
          b:arr};
        if (net.dcOk && net.dc && net.dc.readyState==="open"){
          try { net.dc.send(JSON.stringify(o)); } catch(e){}
          if (nowMs-(net.lastBfMq||0)>500){ net.lastBfMq=nowMs; netPub(topic, o, 0); }
        } else netPub(topic, o, 0);
      }
      // 攻击阶段低频重发 atk：成员掉线重连/丢包时自愈（成员已在战斗中会忽略）
      if (g_state===ST_ATTACK && nowMs-(net.lastAtkPub||0)>1500){
        net.lastAtkPub=nowMs;
        netRtcSend({t:"atk", from:net.cid, pat:g_pattern, txt:g_subtitle, turn:g_turn}, 1, 1);
      }
      // ② 队友看不到的状态迁移（胜利/失败/台词）
      if (g_state!==net.lastState){
        if (g_state===ST_WIN||g_state===ST_LOSE||g_state===ST_MENU)
          netRtcSend({t:"st", from:net.cid, s:g_state, txt:g_subtitle}, 1, 3);
        net.lastState=g_state;
      }
    }
  }
}
netConnect();

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
  g_dead=false; g_deadChoice=false; g_deadSel=0;
  net.myAct=false; net.pAct=false; net.pDead=false; net.pActPending=false;
  // 新一场：队友心的插值状态清掉（上一场可能停在 -999 的「阵亡坐标」上）
  net.px=undefined; net.dpx=undefined; net.pvx=0; net.pvy=0;
  AddRing(JEV_CX,JEV_CY,120,255,230,150);
  AddRing(JEV_CX,JEV_CY,70,255,255,220);
  BurstParts(JEV_CX,JEV_CY,18,180,255,240,190,0.7);
  AddShake(0.3,4);
  Say(`${B.name} 拦住了你的去路！`);
  crtDirty = true;
  BgmStop(); BgmStart(B.bgm);
  // 注意：这里不再广播 st:ST_INTRO。开战由 StartBattle 的 start 事件负责，
  // 重复的 INTRO 会在队员端把刚同步的子弹场/状态清回开场（曾导致队员无弹幕、不掉血）。
}
function GoTitle(){
  g_state=ST_TITLE; g_stateT=0;
  g_bullets=[]; g_dmg=[]; g_sparks=[];
  Say(""); BgmStop();
  if (isLeader()) netPubRetry(net.teamTopic, {t:"st", from:net.cid, s:ST_TITLE}, 3);
}
function StartBattle(boss){
  g_boss=boss; ResetGame();
  if (isLeader()){
    net.startNo=(net.startNo||0)+1;
    netPubRetry(net.teamTopic, {t:"start", from:net.cid, boss, b:net.startNo}, 3);
  }
}
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
  g_spawnT=0.2; g_knifeWarn=-1; g_fired=false; g_waveN=0; g_sliceT=0; g_chainN=0; g_gridWarn.length=0;
  g_heartX=BOX_CX; g_heartY=BOX_CY;
  net.myAct=false; net.pAct=false;
  for (let i=0;i<4;i++) if (B.pat[i]===g_pattern){ Say(B.patLine[i]); break; }
  if (g_boss===0) playVoice(randInt(2)===0 ? "Jevil_voiceclip_CHAOS.wav" : "Jevil_voiceclip_ANYTHING.wav");
  g_state=ST_ATTACK; g_stateT=0;
  if (isLeader()) netPubRetry(net.teamTopic, {t:"atk", from:net.cid, pat:g_pattern, txt:g_subtitle, turn:g_turn}, 3);
}
function randInt(n){ _seed=(_seed*48271)%2147483647; return _seed%n; }
function rndf(a,b){ return rnd(a,b); }

function playVoice(file){
  try { const a = new Audio(ASSET(file)); a.volume=0.9; a.play().catch(()=>{}); } catch(e){}
}

// ---------------- 命中 ----------------
function HitPlayer(dmg){
  if (g_inv>0 || g_dead) return;
  g_hp-=dmg; g_inv=1.0; g_redFlash=0.35;
  AddShake(0.25,5);
  BurstParts(g_heartX,g_heartY,10,130,255,80,110,0.5);
  for (let i=0;i<3;++i)
    g_sparks.push({x:g_heartX+rnd(-10,10), y:g_heartY+rnd(-10,10), t:0, scale:rnd(0.6,1.1)});
  if (g_hp<=0){
    g_hp=0;
    AddShake(0.5,8);
    BurstParts(g_heartX,g_heartY,24,200,255,70,100,0.8);
    if (net.role){                             // 联机：倒地后可以「观战」或退出，战斗继续跑
      g_dead=true; g_deadChoice=false;
      Say("");
    } else {
      g_state=ST_LOSE; g_stateT=0;
      Say("你被混沌吞没了……");
    }
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
function DoAttack(dmg){        // 出刀：队长端权威扣血；队员端只出表现，血量等队长快照回灌
  if (isMember()){
    g_jevHpShown=true; g_hitFlash=0.25; g_jevShake=0.5;
    AddHitStop(0.09+0.06*Math.min(1,dmg/60));
    AddShake(0.18,3+dmg*0.06);
    BurstParts(JEV_CX+rnd(-20,20),JEV_CY+rnd(-20,10),12,150,255,240,160,0.5);
    g_dmg.push({x:JEV_CX+rnd(-30,30), y:JEV_CY-40, vy:-55, life:1.0, val:dmg, miss:false});
    g_sparks.push({x:JEV_CX+rnd(-40,40), y:JEV_CY+rnd(-30,30), t:0, scale:1.6});
    return;
  }
  HitJevil(dmg);
}
function DoPlayerAction(){
  const B = Boss();
  const after = net.role ? ST_WAIT : ST_MENU;    // 联机：行动结束后要跟队友对表
  if (g_sub===SM_ACT){
    if (g_subSel===0){ StartDialog(B.check, after); }
    else {
      g_pacify++;
      if (g_pacify>=B.actNeed){
        g_spareReady=true;
        StartDialog(`${B.name} 累了……可以饶恕了！（MERCY）`, after);
      } else {
        StartDialog(`你安抚了${B.name}……（${g_pacify}/${B.actNeed}）`, after);
      }
      g_sparks.push({x:JEV_CX+rnd(-40,40), y:JEV_CY+rnd(-40,40), t:0, scale:1.2});
    }
    g_actionKind="act"; g_actionDmg=0;
  } else if (g_sub===SM_ITEM){
    if (g_items>0){
      g_items--; g_hp=Math.min(PLAYER_MAXHP, g_hp+60);
      g_dmg.push({x:JEV_CX, y:JEV_CY-60, vy:-40, life:0.8, val:60, miss:false});
      StartDialog("你吃掉了魔法软糖，回复了 60 HP！", after);
    } else StartDialog("软糖吃光了……", after);
    g_actionKind="item"; g_actionDmg=0;
  } else if (g_sub===SM_MERCY){
    if (g_subSel===0){
      if (g_spareReady){
        for (let i=0;i<10;++i)
          g_sparks.push({x:JEV_CX+rnd(-80,80), y:JEV_CY+rnd(-90,90), t:0, scale:rnd(1.0,2.0)});
        g_state=ST_WIN; g_stateT=0;
        Say(`${B.name} 安静下来，睡了一个好觉……`);
        g_sub=SM_NONE;
        return;
      } else {
        StartDialog(`${B.name} 还没平息，无法饶恕！（多试试 ACT 安抚）`, after);
      }
    } else StartDialog("走不掉的……战斗还没有结束！", after);
    g_actionKind="mercy"; g_actionDmg=0;
  }
  g_sub=SM_NONE;
}

// ---------------- 联机回合：行动对表 ----------------
function netBothActed(){                       // 双方都行动完 → 进入该回合的攻击阶段
  if (g_state===ST_ATTACK) return;
  StartDialog(Boss().line[randInt(5)], ST_ATTACK);
}
function AfterAction(kind, dmg){               // 本回合自己的行动结束（出刀/ACT/道具/饶恕）
  g_actionKind=kind||""; g_actionDmg=dmg|0;
  if (!net.role){ StartDialog(Boss().line[randInt(5)], ST_ATTACK); return; }
  net.myAct=true;
  netRtcSend({t:"act", from:net.cid, turn:g_turn, kind:g_actionKind, dmg:g_actionDmg}, 1, 2);
  // 队友先出过刀 → 直接开打；队友已阵亡（在观战）→ 不用等他，他那边跟着 atk 走
  if (net.pAct || net.pDead){ netBothActed(); return; }
  g_state=ST_WAIT; g_stateT=0;
  Say("");
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

  // 联机：已阵亡的人在菜单回合自动算「已行动」，不然队友会被卡在等刀状态
  if (g_dead && net.role && g_state===ST_MENU && !net.myAct){
    net.myAct=true;
    netRtcSend({t:"act", from:net.cid, turn:g_turn, kind:"dead", dmg:0}, 1, 2);
    if (net.pAct) netBothActed();
  }

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
      else if (nx===ST_WAIT){ AfterAction(g_actionKind, g_actionDmg); }
      else if (nx===ST_ATTACK){
        if (isMember()){
          g_afterDialog=ST_ATTACK;                 // 等队长的 atk 事件
          if (g_stateT>6){                         // 看门狗：atk 全丢时兜底开打
            g_pattern=g_lastPat; g_bullets=[];
            g_state=ST_ATTACK; g_stateT=0;
            g_spawnT=0; g_fired=true; g_knifeWarn=-1; g_sliceT=0; g_chainN=0; g_waveN=0;
            g_gridWarn.length=0; g_heartX=BOX_CX; g_heartY=BOX_CY;
          }
        }
        else SpawnPattern();
      }
    }
    break;
  case ST_WAIT:                                    // 等队友出刀：只认暂停键
    g_stateT+=dt;
    if (!net.role){ netBothActed(); break; }         // 队伍已经没了（队友退了/解散）→ 立刻继续单打
    if (net.pDead){ netBothActed(); break; }         // 队友已倒下（观战）→ 不用他出刀
    if (net.pseen && Date.now()-net.pseen>3500){      // 队友心跳断了（掉线没发 bye）→ 别干等
      net.pAct=true; netBothActed(); break;
    }
    if (g_stateT>15){ net.pAct=true; netBothActed(); }   // 兜底开打
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
      if (net.role) AfterAction(g_actionKind||"fight", g_actionDmg);
      else StartDialog(Boss().line[randInt(5)], ST_ATTACK);
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

    // 红心移动（键盘）—— 已阵亡（观战）时不再操控
    let sp = HEART_SPD*dt;
    if (!g_dead){
      if (keys.has("ArrowLeft"))  g_heartX-=sp;
      if (keys.has("ArrowRight")) g_heartX+=sp;
      if (keys.has("ArrowUp"))    g_heartY-=sp;
      if (keys.has("ArrowDown"))  g_heartY+=sp;
      // 触屏：虚拟摇杆（方向即时生效，松手立刻停，无滑行）
      if (joy.active){
        const d=Math.hypot(joy.dx,joy.dy);
        if (d>2){
          const k=Math.min(1, d/joy.R);          // 摇杆行程 → 速度比例
          g_heartX+=joy.dx/d*sp*k; g_heartY+=joy.dy/d*sp*k;
        }
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

    // 预警→开火（成员端不刷弹，只跑子弹更新；子弹由队长事件转发）
    const firing = g_stateT>=B.warn && !isMember();
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
      // ---- Tenna：All-Star Cast（星星穿板环射，屏幕明暗交替）
      if (g_pattern===P_DEAL && g_spawnT<=0){
        g_spawnT=0.92/ramp;
        const spd=300*ramp;
        if (g_waveN%2===0){                  // 横穿波
          const N=5, gap=randInt(N), side=randInt(2);
          const step=(BOX_Y1-BOX_Y0-24)/(N-1);
          for (let i=0;i<N;++i){
            if (i===gap||(i+1)%N===gap) continue;
            const y=BOX_Y0+12+i*step;
            SpawnBulletAt(B_STAR, side===0?BOX_X0-24:BOX_X1+24, y,
                          side===0?spd:-spd, 0, 10);
            g_bullets[g_bullets.length-1].dmg=9;
          }
        } else {                             // 纵穿波（多留一个缺口，避免队形封死）
          const N=4, gap=randInt(N);
          const step=(BOX_X1-BOX_X0-24)/(N-1);
          for (let i=0;i<N;++i){
            if (i===gap||(i+1)%N===gap) continue;
            const x=BOX_X0+12+i*step;
            SpawnBulletAt(B_STAR, x, BOX_Y0-24, 0, spd, 10);
            g_bullets[g_bullets.length-1].dmg=9;
          }
        }
        AddRing(BOX_CX,BOX_CY,50,255,220,120);
        g_waveN++;
      }
      // ---- Tenna：Smash Cut（真实切屏 + 闪电五连/三连）
      if (g_pattern===P_MAIL){
        if (g_knifeWarn<0 && g_spawnT<=0){
          g_knifeWarn=0.36;
          g_warnX=rnd(BOX_X0+24,BOX_X1-24);
          g_chainN = (g_turn%2===0)?5:3;     // 交替 5 连 / 3 连
        }
        if (g_knifeWarn>=0){
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){
            g_sliceT=1.3;                    // 切屏保持 1.3s（连击期间一直开着）
            g_bullets.push({type:B_PHONE, ring:false, vx:0, vy:0, rot:0, rotv:0,
              rx:0, r:6, life:0.5, dmg:11, phase:0, bolt:true,
              x:g_warnX, y:BOX_CY, ang:0, ry:0, w:0, cx:0, cy:0});
            for (let i=0;i<12;++i)
              SpawnPart(g_warnX+rnd(-6,6), rnd(BOX_Y0,BOX_Y1), rnd(-70,70),
                        rnd(-180,-60), rnd(0.2,0.5), rnd(2,5), 200,230,255);
            AddRing(g_warnX,BOX_CY,80,220,235,255);
            AddShake(0.22,5);
            g_chainN--;
            g_spawnT = (g_chainN>0) ? 0.24 : 1.35/ramp;
          }
        }
      }
      // ---- Tenna：Rimshot（反弹笑脸星 + 五点发光散弹）
      if (g_pattern===P_CALL && g_spawnT<=0){
        g_spawnT=2.3/ramp;
        for (let k=0;k<2;++k){
          SpawnBulletAt(B_STAR, k===0?BOX_X0+30:BOX_X1-30,
                        k===0?BOX_Y0+30:BOX_Y1-30,
                        (k===0?1:-1)*(110+26*Math.min(g_turn,4)),
                        (k===0?1:-1)*82, 12);
          const b=g_bullets[g_bullets.length-1];
          b.bounce=true; b.tt=4.2; b.dmg=9; b.rotv=4; b.r=12;
        }
        const base=rnd(0,6.2832);
        for (let i=0;i<5;++i){
          const a=base+i*1.2566;
          SpawnBulletAt(B_STAR, BOX_CX, BOX_CY,
                        Math.cos(a)*175*ramp, Math.sin(a)*135*ramp, 10);
          g_bullets[g_bullets.length-1].dmg=9;
        }
        AddRing(BOX_CX,BOX_CY,60,255,220,120);
      }
      // ---- Tenna：电视信号波（竖向信号墙横扫，缺口蛇形移动）
      if (g_pattern===P_KROMER){
        if (!g_fired){                              // 预警阶段
          if (g_knifeWarn<0){ g_knifeWarn=0.45; g_warnSide=randInt(2); g_waveN=0; }
          g_knifeWarn-=dt;
          if (g_knifeWarn<0){ g_fired=true; g_spawnT=0; }
        } else {                                    // 逐道信号墙推进
          if (g_spawnT<=0 && g_stateT<B.dur-1.5){
            g_spawnT=0.62/ramp;
            const spd=(215+40*Math.min(g_turn,5))*ramp;
            const step=20;
            // 高回合交替反向出手，形成交叉信号墙
            const side=(g_turn>=3 && (g_waveN%2===1)) ? 1-g_warnSide : g_warnSide;
            const gapY=BOX_CY+Math.sin(g_waveN*1.15)*50;   // 缺口蛇形移动
            for (let y=BOX_Y0+10; y<=BOX_Y1-10; y+=step){
              if (Math.abs(y-gapY)<38) continue;           // 缺口
              const px=side===0 ? BOX_X0-8 : BOX_X1+8;
              SpawnBulletAt(B_PHONE, px, y, side===0?spd:-spd, 0, 10);
              const b=g_bullets[g_bullets.length-1];
              b.dmg=8; b.phase=(y-BOX_Y0)*0.075; b.wavy=15; b.wy=y;
            }
            AddShake(0.12,2.5);
            g_waveN++;
            if (g_waveN>=7){ g_fired=false; g_knifeWarn=-1; g_waveN=0; g_spawnT=0.5; }
          }
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
      // ---- Pink：三车道猫脸冲锋 + 可拾爱心
      if (g_pattern===P_MAGIC){
        if (g_waveN<10 && g_spawnT<=0 && g_stateT<B.dur-1.2){
          g_spawnT=1.05/ramp;
          const lanes=[BOX_Y0+22, BOX_CY, BOX_Y1-22];
          const gap=randInt(3);
          const speed=(250+Math.min(g_waveN,6)*18)*ramp;
          for (let i=0;i<3;++i){
            if (i===gap) continue;
            SpawnBulletAt(B_WHITECAT, BOX_X1+24, lanes[i], -speed, 0, 13);
            const b=g_bullets[g_bullets.length-1];
            b.dmg=9; b.rotv=0;
          }
          if (g_waveN>=1 && randInt(2)===0){
            // 爱心走车道缝隙，避免和猫重叠看不清
            const gapsY=[(lanes[0]+lanes[1])/2, (lanes[1]+lanes[2])/2];
            SpawnBulletAt(B_HEART, BOX_X1+20, gapsY[randInt(2)], -95*ramp, 0, 12);
            const b=g_bullets[g_bullets.length-1];
            b.pick=true; b.dmg=0; b.rotv=0;
          }
          AddRing(BOX_X1-6,BOX_CY,46,255,250,250);
          g_waveN++;
        }
      }
      // ---- Pink：喵喵炸弹
      if (g_pattern===P_LOVE && g_spawnT<=0){
        g_spawnT=1.55/ramp;                 // Pink 整体 ramp 偏高，单独放宽间隔
        const bias=g_loveN%4;
        let bx;
        if (bias===0)      bx=rnd(BOX_X0+10,BOX_X0+40);
        else if (bias===1) bx=rnd(BOX_X1-40,BOX_X1-10);
        else               bx=rnd(BOX_X0+10,BOX_X1-10);
        SpawnBulletAt(B_CATBOMB, bx, BOX_Y0-20, 0, rnd(120,155)*ramp, 14);
        const b=g_bullets[g_bullets.length-1];
        b.life=rnd(0.26,0.95); b.rotv=2.4; b.dmg=8; b.phase=rnd(0,6.28);
        g_loveN++;
      }
      // ---- Pink：4x4 炸弹格（预告闪烁 → 整行整列十字同时引爆）
      if (g_pattern===P_MEOW && g_spawnT<=0){
        g_spawnT=1.05/ramp;
        const total=(g_turn>=6)?3:(g_turn>=4)?2:1;
        const used=[];
        for (let k=0;k<total;++k){
          let gx=0, gy=0, ok=false;
          for (let tr=0;tr<10 && !ok;++tr){
            gx=randInt(4); gy=randInt(4);
            ok=!used.some(c=>c[0]===gx&&c[1]===gy);
          }
          used.push([gx,gy]);
          g_gridWarn.push({gx,gy,t:1.05/ramp});
          const cw=(BOX_X1-BOX_X0-100)/3, ch=(BOX_Y1-BOX_Y0-44)/3;
          BurstParts(BOX_X0+50+gx*cw, BOX_Y0+22+gy*ch, 5,80,255,170,210,0.4);
        }
      }
      // ---- Pink：雷达圈扩散 + 追踪爱心
      if (g_pattern===P_GHOST && g_spawnT<=0){
        g_spawnT=2.3/ramp;
        const cx=rnd(BOX_X0+70,BOX_X1-70), cy=rnd(BOX_Y0+34,BOX_Y1-34);
        const N=14, gap0=randInt(N);
        for (let i=0;i<N;++i){
          const di=(i-gap0+N)%N;
          if (di<4) continue;                    // 留 4 个缺口
          const a=i*6.2832/N;
          SpawnBulletAt(B_GHOST, cx+Math.cos(a)*26, cy+Math.sin(a)*26,
                        Math.cos(a)*95*ramp, Math.sin(a)*95*ramp, 11);
          g_bullets[g_bullets.length-1].dmg=9;
        }
        AddRing(cx,cy,90,255,170,220);
        if (g_turn>=2 && randInt(2)===0){
          SpawnBulletAt(B_HEART, BOX_X1+30, rnd(BOX_Y0+20,BOX_Y1-20), -60, 0, 12);
          const b=g_bullets[g_bullets.length-1];
          b.life=-1; b.tt=6; b.dmg=9;            // 追踪爱心
        }
      }
    }

    // ---- 更新子弹（spawned 缓冲防爆）
    if (g_sliceT>0) g_sliceT-=dt;
    // 炸弹格引信：到点后整行整列十字瞬间打满（只由队长跑，队员端用快照覆盖预告）
    if (g_gridWarn.length && !isMember()){
      for (const w of g_gridWarn){
        w.t-=dt;
        if (w.t<=0 && !w.fired){
          w.fired=true;
          const cw=(BOX_X1-BOX_X0-100)/3, ch=(BOX_Y1-BOX_Y0-44)/3;
          const bx=BOX_X0+50+w.gx*cw, by=BOX_Y0+22+w.gy*ch;
          const dir4=[[1,0],[-1,0],[0,1],[0,-1]];
          for (let i=0;i<4;++i){
            g_bullets.push({type:B_CROSS, ring:false, x:bx, y:by,
              vx:dir4[i][0], vy:dir4[i][1], rot:0, rotv:0, r:11, dmg:10,
              life:660, phase:0, ang:0, rx:0, ry:0, w:0, cx:0, cy:0});
          }
          AddRing(bx,by,80,255,150,190);
          BurstParts(bx,by,16,200,255,140,180,0.55);
          AddShake(0.32,6);
        }
      }
      g_gridWarn=g_gridWarn.filter(w=>!w.fired);
    }
    const spawned=[];
    for (const b of g_bullets){
      if (b._net){                              // 队长同步来的弹：位置跟随手，life/方向用队长权威值
        if (b.type===B_CROSS){                  // 十字光束：整条线段判伤（绝不能当竖线激光）
          const ex=b.x+b.vx*b.life, ey=b.y+b.vy*b.life;
          if (!g_dead && distToSeg(g_heartX,g_heartY,b.x,b.y,ex,ey) < b.r+6) HitPlayer(b.dmg>0?b.dmg:12);
          continue;
        }
        if (b.pick){                            // 拾取爱心：回血（原来掉进通用碰撞，被当成伤害）
          const dxp=b.x-g_heartX, dyp=b.y-g_heartY;
          if (!g_dead && dxp*dxp+dyp*dyp < (b.r+7)*(b.r+7)*0.80){
            g_hp=Math.min(PLAYER_MAXHP, g_hp+12);
            AddRing(b.x,b.y,50,255,120,170);
            BurstParts(b.x,b.y,10,90,255,170,150,0.5);
            playSfx("snd_menu_select");
            b.x=-9999; b._taken=true;
            netRtcSend({t:"pick", from:net.cid, sid:b._sid}, 1, 1);   // 告诉队长这颗已经被我吃掉
          }
          continue;
        }
        if (b.st || (b.life>0 && !b.ring && b.vx===0 && b.vy===0)){   // 激光：整条线判伤
          if (!g_dead){
            const hitLine = (b.rx>0.5) ? Math.abs(g_heartY-b.y)<10 : Math.abs(g_heartX-b.x)<10;
            if (hitLine) HitPlayer(b.dmg>0?b.dmg:12);
          }
        } else {
          const qx=b.x, qy=b.y;
          b.x+=b.vx*dt; b.y+=b.vy*dt;           // 快照之间的帧间补偿
          if (!g_dead){
            // 线段判伤：8Hz 快照下白猫一帧能跳几十像素，圆点判定会直接穿过去
            const rr=(b.r+7)*(b.r+7)*0.80;
            const dxs=b.x-g_heartX, dys=b.y-g_heartY;
            if (dxs*dxs+dys*dys < rr ||
                distToSeg(g_heartX,g_heartY,qx,qy,b.x,b.y) < Math.sqrt(rr))
              HitPlayer(b.dmg>0?b.dmg:12);
          }
        }
        continue;                               // 不跑本地生成/分裂/寿命递减
      }
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
        if (b.tt!==undefined){                // 限时消失（反弹星/追踪爱心）
          b.tt-=dt;
          if (b.tt<=0){ b.x=-9999; continue; }
        }
        if (b.bounce){                        // 板内反弹
          if (b.x<BOX_X0+10){ b.x=BOX_X0+10; b.vx=Math.abs(b.vx); }
          if (b.x>BOX_X1-10){ b.x=BOX_X1-10; b.vx=-Math.abs(b.vx); }
          if (b.y<BOX_Y0+10){ b.y=BOX_Y0+10; b.vy=Math.abs(b.vy); }
          if (b.y>BOX_Y1-10){ b.y=BOX_Y1-10; b.vy=-Math.abs(b.vy); }
        }
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        b.rot+=b.rotv*dt;
        if (b.type===B_DIAMOND) b.x+=Math.sin(g_stateT*3+b.phase)*22*dt;
        if (b.type===B_COIN)    b.y+=Math.sin(g_stateT*4+b.phase)*34*dt;
        if (b.type===B_MAIL)    b.x+=Math.sin(g_stateT*3.2+b.phase)*18*dt;
        if (b.wavy){                           // 蛇行波：绕基准线正弦摆动
          b.wt=(b.wt||0)+dt;
          b.y=b.wy+Math.sin(b.wt*5.5+b.phase)*b.wavy;
        }
      }
      // 爱心拾取
      if (b.pick){
        const dx=b.x-g_heartX, dy=b.y-g_heartY;
        if (dx*dx+dy*dy < (b.r+7)*(b.r+7)*0.80){
          g_hp=Math.min(PLAYER_MAXHP, g_hp+12);
          AddRing(b.x,b.y,50,255,120,170);
          BurstParts(b.x,b.y,10,90,255,170,150,0.5);
          playSfx("snd_menu_select");
          b.x=-9999;
        }
        continue;
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
      if (b.pick) return !(b.x<BOX_X0-40);
      if (b.type===B_WHITECAT) return !(b.x<BOX_X0-90);
      return !(b.x<BOX_X0-60 || b.x>BOX_X1+60 || b.y<BOX_Y0-60 || b.y>BOX_Y1+60);
    });

    if (g_stateT>B.dur && g_state===ST_ATTACK){
      g_bullets=[];
      g_turn++;
      g_state=ST_MENU; g_stateT=0; Say("");
      net.myAct=false; net.pAct=false;          // 新回合：双方重新对表
      if (net.pActPending){ net.pActPending=false; net.pAct=true; }   // 上一回合末尾收到的行动
    }
    break;
  }
  }
  netSmoothTick(dt);                            // 队友心的平滑推进（不依赖网络帧率）
  if (net.role && g_dead && net.pDead && g_state!==ST_LOSE){   // 两人都倒下 → 结算
    g_state=ST_LOSE; g_stateT=0;
    Say("你们都倒下了……");
  }
}

// ---------------- 输入 ----------------
const keys = new Set();
let touchStart = null;         // 判定点按 vs 拖动
// 虚拟摇杆：按下处为底座，拖动方向即移动方向，松手立即停止
const joy = { active:false, id:null, bx:0, by:0, dx:0, dy:0, R:34 };

// 每帧渲染时重建的点击热区
let hotspots = [];
function hot(x,y,w,h,fn){ hotspots.push({x,y,w,h,fn}); }

function openPause(){
  if (g_pauseUI) return;
  if (net.role){                       // 联机：只弹面板，游戏继续跑（不能靠暂停耍赖）
    g_pauseUI=true; g_pauseSel=0;
  } else {
    g_pauseFrom=g_state; g_pauseSel=0; g_state=ST_PAUSE;
  }
  playSfx("snd_menu_move");
}
function closePause(){ g_pauseUI=false; }
function deadQuit(){                    // 阵亡后：退出战斗 / 退出队伍
  g_deadChoice=true;
  if (isMember()) netLeave();
  else GoTitle();
}
function deadSpectate(){ g_deadChoice=true; Say("观战中……按暂停键可退出"); }

function pressKey(vk){        // 统一按键处理（键盘 + 触屏等价）
  // ---- 联机暂停面板（最高优先级，不冻结游戏）
  if (g_pauseUI){
    if (vk==="ArrowUp"){ g_pauseSel=(g_pauseSel+2)%3; playSfx("snd_menu_move"); }
    if (vk==="ArrowDown"){ g_pauseSel=(g_pauseSel+1)%3; playSfx("snd_menu_move"); }
    if (vk==="ArrowLeft"||vk==="ArrowRight"){
      if (g_pauseSel===1){
        g_vol=clamp(g_vol+(vk==="ArrowLeft"?-10:10),0,100);
        bgm.volume=g_vol/100; playSfx("snd_menu_move");
      }
    }
    if (vk==="Escape"){ closePause(); playSfx("snd_menu_move"); return; }
    if (vk==="z"||vk==="Enter"){
      if (g_pauseSel===0){ playSfx("snd_menu_select"); closePause(); }
      else if (g_pauseSel===2){
        playSfx("snd_menu_select"); closePause();
        if (isMember()) netLeave(); else GoTitle();
      }
    }
    return;
  }
  // ---- 联机：已阵亡 → 只认「退出 / 观战」和暂停键
  if (g_dead && g_state!==ST_LOSE && g_state!==ST_TITLE){
    if (!g_deadChoice){
      if (vk==="ArrowLeft"){ g_deadSel=0; playSfx("snd_menu_move"); }
      if (vk==="ArrowRight"){ g_deadSel=1; playSfx("snd_menu_move"); }
      if (vk==="z"||vk==="Enter"){
        playSfx("snd_menu_select");
        if (g_deadSel===0) deadQuit(); else deadSpectate();
      }
    }
    if (vk==="Escape") openPause();
    return;
  }
  // ---- 等队友出刀：只能按暂停键
  if (g_state===ST_WAIT){
    if (vk==="Escape") openPause();
    return;
  }
  // ---- 联机：Tab 选择玩家 / Enter 邀请·同意·退队
  if (vk==="Tab"){
    if ((g_state===ST_TITLE||g_state===ST_MENU) && !net.role){
      const L=netLobbyList();
      if (L.length){ net.selIdx=(net.selIdx+1)%(L.length+1); net.panel=true; playSfx("snd_menu_move"); }
      else Say("暂无其他在线玩家");
    }
    return;
  }
  if (vk==="Enter"){
    // 战斗中 Enter 归菜单确认用；只有在大厅/结算界面 Enter 才是退队
    if (isMember() && (g_state===ST_TITLE||g_state===ST_WIN||g_state===ST_LOSE||g_state===ST_INTRO)){ netLeave(); return; }
    if (net.invite){ netAcceptInvite(); return; }                // 同意邀请
    if ((g_state===ST_TITLE||g_state===ST_MENU) && !net.role){
      const L=netLobbyList();
      if (L.length && net.selIdx>0 && net.selIdx<=L.length){ netSendInvite(L[net.selIdx-1].cid); return; }
    }
    if (net.invSent){ Say("等待对方回应…"); return; }
  }
  if (vk==="x" && net.invite){ netDeclineInvite(); return; }     // 拒绝邀请
  // ---- 主界面
  if (g_state===ST_TITLE){
    if (isMember()) return;                                      // 队员不能操作主界面
    if (vk==="ArrowLeft"){ g_bossSel=(g_bossSel+BOSS_N-1)%BOSS_N; playSfx("snd_menu_move"); }
    if (vk==="ArrowRight"){ g_bossSel=(g_bossSel+1)%BOSS_N; playSfx("snd_menu_move"); }
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); net.selIdx=0; StartBattle(g_bossSel); }
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
      g_actionKind="fight"; g_actionDmg=g_pendingDmg;
      DoAttack(g_pendingDmg);
      g_state=ST_DMG; g_stateT=0;
    }
    break;
  case ST_WIN: case ST_LOSE:
    if (isMember()) break;                                       // 成员等队长同步
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); StartBattle(g_boss); }   // 重开也要广播，队员才不会卡在结算画面
    break;
  }
  if (vk==="Escape" && g_state>=ST_INTRO && g_state!==ST_PAUSE) openPause();
}

window.addEventListener("keydown", e=>{
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Tab"].includes(e.key)) e.preventDefault();
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
    // 按在热区上（暂停按钮等）不启动摇杆
    let overHot=false;
    for (const h of hotspots){ if (p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){ overHot=true; break; } }
    if (!overHot){
      joy.active=true; joy.id=e.pointerId;
      joy.bx=p.x-VOX; joy.by=p.y-VOY; joy.dx=0; joy.dy=0;
    }
    touchStart={...p, t:performance.now()};
    return;
  }
  touchStart={...p, t:performance.now()};
});
cv.addEventListener("pointermove", e=>{
  if (!joy.active || e.pointerId!==joy.id) return;
  e.preventDefault();
  const p = toLogical(e.clientX, e.clientY);
  let dx=p.x-VOX-joy.bx, dy=p.y-VOY-joy.by;
  const d=Math.hypot(dx,dy);
  if (d>joy.R){ dx=dx/d*joy.R; dy=dy/d*joy.R; }   // 摇杆行程限幅
  joy.dx=dx; joy.dy=dy;
});
function endPointer(e){
  const wasJoy = joy.active && e.pointerId===joy.id;
  if (wasJoy){ joy.active=false; joy.dx=0; joy.dy=0; joy.id=null; }
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
cv.addEventListener("pointercancel", e=>{ joy.active=false; joy.dx=0; joy.dy=0; joy.id=null; touchStart=null; });

// ---------------- 渲染 ----------------
const ctx = cv.getContext("2d");
let SS = 1;                          // 超采样倍数
let crtCanvas = null, crtDirty = true;

function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  SS = clamp(Math.round(dpr*10)/10, 1, 2);   // 最高 2 倍超采样，兼顾手机性能
  // 用 documentElement.clientWidth/Height：比 innerHeight 更贴近可视区，
  // 手机地址栏/工具栏占位导致 innerHeight 偏大时不会把底部 UI 挤出屏幕
  const ww = document.documentElement.clientWidth  || window.innerWidth;
  const wh = document.documentElement.clientHeight || window.innerHeight;
  const ar = ww/wh;
  if (ar >= 1){                              // 横屏：高度固定 480，宽度铺满（不限上限，避免两侧留黑）
    WINH = 480;
    WINW = Math.max(640, Math.round(480*ar));
  } else {                                   // 竖屏：宽度固定 640，高度铺满
    WINW = 640;
    WINH = Math.max(480, Math.round(640/ar));
  }
  VOX = (WINW-640)/2;
  VOY = Math.max(0, Math.round((WINH-480-58)/2));   // 底部留出 UI 高度后整体居中
  crtDirty = true;
  // 画布缓冲按逻辑尺寸等比放大：x/y 缩放比完全一致，
  // 不会因为 innerHeight/innerWidth 的取整差异把底部按钮挤出可视区
  cv.width  = Math.max(1, Math.round(WINW*Math.min(SS,1.5)));
  cv.height = Math.max(1, Math.round(WINH*Math.min(SS,1.5)));
  cv.style.width  = ww + "px";
  cv.style.height = wh + "px";
  const hint = document.getElementById("rotate");
  if (hint) hint.style.display = "none";     // 竖屏也能全屏显示，不再强制横屏
}
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", ()=>{ setTimeout(fitCanvas,120); });
// 移动端地址栏收起/展开会改变可视区高度，visualViewport 变化时重算
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitCanvas);
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

function rightText(s, rx, y, size, color, bold=true){   // 以 rx 为右边界右对齐
  ctx.font = `${bold?"bold ":""}${size}px "Microsoft YaHei","PingFang SC",sans-serif`;
  const w = ctx.measureText(s).width;
  outlineText(s, rx-w/2, y, size, color, rx-w/2, bold);
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
  outlineText("混沌挑战", 0, 22+VOY, 56, "#ffec78", WINW/2);
  outlineText("CHOOSE  YOUR  CHAOS", 0, 92+VOY, 15, "#c8dcff", WINW/2, false);

  for (let i=0;i<BOSS_N;++i){
    const x=VOX+34+i*146, y=VOY+118, w=132, h=214;
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
    outlineText("点选角色　再点一次开战", 0, 352+VOY, 15, "#d2dce1", WINW/2, false);
  else
    outlineText("← → 选择　Z 开战", 0, 352+VOY, 15, "#d2dce1", WINW/2, false);
  // 联机信息
  if (net.role){
    outlineText(isLeader() ? "已组队：与 "+net.partnerName+"（TA 将与你一起挑战）"
                           : "已组队：队长 "+net.partnerName+" · Enter 退出组队",
                0, 382+VOY, 14, "#ffd257", WINW/2, false);
  } else if (net.on){
    outlineText(isTouch ? "点右下角在线人数 可查看玩家并邀请组队"
                        : "Tab 选择玩家 · Enter 发出组队邀请",
                0, 382+VOY, 13, "#8ea2d8", WINW/2, false);
  }
  renderNetHUD();
}

// ---- 暂停
function RenderPause(){
  ctx.fillStyle = "rgba(0,0,0,0.80)";
  ctx.fillRect(0,0,WINW,WINH);
  outlineText("暂　停", 0, 56+VOY, 56, "#ffec78", WINW/2);

  // 继续游戏
  outlineText("继续游戏", 0, 168+VOY, 24, g_pauseSel===0?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===0){ ctx.save(); ctx.imageSmoothingEnabled=false; drawImg(img("soul"), WINW/2-104, 180+VOY, 24,24); ctx.restore(); }
  hot(WINW/2-140, 158+VOY, 280, 52, ()=>{ playSfx("snd_menu_select"); g_state=g_pauseFrom; });

  // 音量
  outlineText(`音量　　${g_vol}%`, 0, 238+VOY, 24, g_pauseSel===1?"#fff":"#c2becd", WINW/2);
  const bx = WINW/2-100, by = 282+VOY, bw = 200, bh = 12;
  ctx.fillStyle="rgba(60,60,90,0.9)"; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle="#78d2ff"; ctx.fillRect(bx,by,bw*g_vol/100,bh);
  ctx.strokeStyle="rgba(200,200,240,0.5)"; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,bh);
  btn(bx-72, by-12, 48, 36, "－", ()=>{ g_vol=clamp(g_vol-10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  btn(bx+bw+24, by-12, 48, 36, "＋", ()=>{ g_vol=clamp(g_vol+10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  hot(bx-10, by-20, bw+20, 44, ()=>{ g_pauseSel=1; });

  // 退出
  outlineText("退出挑战", 0, 348+VOY, 24, g_pauseSel===2?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===2){ ctx.save(); ctx.imageSmoothingEnabled=false; drawImg(img("soul"), WINW/2-104, 360+VOY, 24,24); ctx.restore(); }
  hot(WINW/2-140, 338+VOY, 280, 52, ()=>{ playSfx("snd_menu_select"); GoTitle(); });

  if (!isTouch) outlineText("↑ ↓ 选择　Z 确认　ESC 继续", 0, 430+VOY, 15, "#bec8cd", WINW/2, false);
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
  // 等比缩放：x/y 用同一个比例，避免两轴独立缩放时的浮点误差
  // 在高分辨率竖屏累积几十像素，把底部按钮推出画布
  const sc = Math.min(cv.width/WINW, cv.height/WINH);
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
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

  // 进入 640x480 场景坐标系（宽屏时居中，两侧/上下由背景补满）
  ctx.save();
  ctx.translate(VOX, VOY);

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
  const inBoxView = (g_state===ST_ATTACK || g_state===ST_LOSE || g_state===ST_WAIT);

  // ---- 攻击预警
  if (g_state===ST_ATTACK && g_stateT<Boss().warn){
    const k=g_stateT/Boss().warn;
    const pulse=0.5+0.5*Math.sin(g_animT*20);
    ctx.strokeStyle=`rgba(255,80,80,${(110+130*pulse)/255})`;
    ctx.lineWidth=3;
    ctx.strokeRect(BOX_X0,BOX_Y0,BOX_X1-BOX_X0,BOX_Y1-BOX_Y0);
    renderWarn(pulse);
    // 技能名：压到框上沿，不再遮挡框内预告图形
    let nm="混沌！";
    for (let i=0;i<4;++i) if (Boss().pat[i]===g_pattern){ nm=Boss().patLine[i]; break; }
    ctx.fillStyle="rgba(12,8,24,0.72)";
    ctx.fillRect(BOX_CX-190, BOX_Y0-19, 380, 22);
    outlineText(nm, 0, BOX_Y0-16, 17, `rgba(255,${Math.floor(110+110*pulse)},${Math.floor(110+60*pulse)},1)`, BOX_CX, false);
  }

  // ---- 子弹
  if (inBoxView){
    const sz=[30,28,30,52,34,30,30,26,30,28,30,32,34,27,30];
    const imKeys=["spade","diamond","club","knife","phone","coin","mail","heart","bomb",
                  "star","paw","ghost","catbomb","whitecat",null];
    // 弹幕裁剪在框内：白猫从框外飞进来时不该在紫色背景上「穿墙」
    ctx.save();
    ctx.beginPath(); ctx.rect(BOX_X0+2, BOX_Y0+2, BOX_X1-BOX_X0-4, BOX_Y1-BOX_Y0-4); ctx.clip();
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
      if (b.st || (b.life>0 && !b.ring && b.vx===0 && b.vy===0)){
        const a=Math.min(1, b.life*2.5);
        const lc = b.bolt ? "210,232,255" : "255,90,120";
        ctx.fillStyle=`rgba(${lc},${0.78*a})`;
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
    ctx.restore();                                   // 结束弹幕裁剪
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

  // ---- 场内战预告（Tenna / Pink 新招式：整个弹幕阶段持续显示）
  if (g_state===ST_ATTACK){
    if (g_pattern===P_MEOW) drawGridWarn();
    else if (g_pattern===P_KROMER && g_fired) drawSignalWarn();
    else if (g_pattern===P_MAIL && g_knifeWarn>=0) drawBoltWarn();
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

  // ---- 红心（联机：队长红心 / 队员蓝心）
  if (inBoxView){
    const vis = (g_inv<=0 || (g_animT%0.16)<0.09) && !g_dead;
    // 队友的心先画（压在下面，回合开始时两人都居中，自己的心要盖在上面）
    if (net.role && net.dpx!==undefined && net.dpx>-900 && g_state===ST_ATTACK){
      const pv = Date.now()-(net.pseen||0) < 4000;    // 超过 4 秒没收到位置就隐藏
      if (pv){
        ctx.save(); ctx.imageSmoothingEnabled=false;
        ctx.globalAlpha=0.92;
        drawImg(partnerSoulImg(), net.dpx, net.dpy, 28,28);
        ctx.restore();
      }
    }
    if (g_state===ST_LOSE){
      const t=Math.min(1, g_stateT/0.8);
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(mySoulImg(), g_heartX-t*26, g_heartY-t*8, 24,24, -t*90);
      drawImg(mySoulImg(), g_heartX+t*26, g_heartY-t*8, 24,24, t*90);
      ctx.restore();
    } else if (vis){
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(mySoulImg(), g_heartX, g_heartY, 28,28);
      ctx.restore();
    }
    // 虚拟摇杆（弹幕阶段按下屏幕时出现）
    if (joy.active){
      const kx=joy.bx+joy.dx, ky=joy.by+joy.dy;
      ctx.save();
      ctx.globalAlpha=0.35;
      ctx.fillStyle="#0a0a14";
      ctx.beginPath(); ctx.arc(joy.bx,joy.by,joy.R+6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.55;
      ctx.strokeStyle="#ffffff"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(joy.bx,joy.by,joy.R+6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=0.85;
      ctx.fillStyle="#ff2244";
      ctx.beginPath(); ctx.arc(kx,ky,14,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle="#ffd0d8"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(kx,ky,14,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();   // 场景坐标系结束
  ctx.restore();   // 震屏结束

  // ---- Smash Cut：真实切屏后处理（沿战斗框中线把画面切成两半滑开）
  if (g_sliceT>0 && g_state===ST_ATTACK){
    const life=1.3, el=life-g_sliceT;
    const open = el<0.28 ? el/0.28 : (g_sliceT<0.28 ? g_sliceT/0.28 : 1);
    const dx=80*open;
    if (dx>1){
      const rw=cv.width/WINW, rh=cv.height/WINH;
      const vh=WINH;                             // 整屏切分（UI 在这之后才画，不受影响）
      const seam=Math.round(VOY+BOX_CY);         // 中缝：战斗框中线
      const topH=Math.max(1,seam), botH=Math.max(1,vh-seam);
      const sw=WINW*rw, sh=vh*rh;
      if (!g_sliceCv){ g_sliceCv=document.createElement("canvas"); g_sliceCtx=g_sliceCv.getContext("2d"); }
      g_sliceCv.width=Math.max(1,Math.round(sw)); g_sliceCv.height=Math.max(1,Math.round(sh));
      g_sliceCtx.drawImage(cv, 0,0,sw,sh, 0,0,g_sliceCv.width,g_sliceCv.height);
      // 虚空：深色 + 电视噪点
      ctx.fillStyle="#07040e"; ctx.fillRect(0,0,WINW,WINH);
      for (let i=0;i<90;++i){
        const ny=rnd(0,WINH), nx=rnd(0,WINW);
        ctx.fillStyle=`rgba(${90+rnd(0,90)|0},${140+rnd(0,80)|0},${200+rnd(0,55)|0},${rnd(0.10,0.42)})`;
        ctx.fillRect(nx, ny, rnd(2,14), 1.5);
      }
      const hy=g_sliceCv.height*seam/vh;
      ctx.drawImage(g_sliceCv, 0,0, g_sliceCv.width, hy, dx, 0, WINW, topH);
      ctx.drawImage(g_sliceCv, 0,hy, g_sliceCv.width, g_sliceCv.height-hy,
                    -dx, seam, WINW, botH);
      // 切口白热边
      const gl=0.6+0.35*Math.sin(g_animT*36);
      ctx.fillStyle=`rgba(228,242,255,${gl*open})`;
      ctx.fillRect(-dx-8, seam-3, WINW+dx*2+16, 5);
      ctx.fillStyle=`rgba(130,170,255,${0.4*open})`;
      ctx.fillRect(-dx-8, seam-11, WINW+dx*2+16, 2);
      ctx.fillRect(-dx-8, seam+8, WINW+dx*2+16, 2);
    }
  }

  // ---- 字幕（预警阶段框沿已经写着同一句招式名，别再叠一遍）
  if (g_subtitle){
    let dup=false;
    if (g_state===ST_ATTACK && g_stateT<Boss().warn){
      for (let i=0;i<4;++i) if (Boss().pat[i]===g_pattern && Boss().patLine[i]===g_subtitle){ dup=true; break; }
    }
    if (!dup) outlineText(g_subtitle, 0, 246+VOY, 20, "#ffe058", WINW/2);
  }
  // 触屏操作提示（第一轮弹幕时出现）
  if (isTouch && g_state===ST_ATTACK && g_turn===0 && g_stateT<3.5 && !g_dead)
    outlineText("按住屏幕出摇杆 拖动方向躲避", 0, VOY+12, 13, "#c8d8ff", WINW/2, false);

  // ---- 底部 UI（贴屏幕底边，预留手机手势条/安全区）
  let SAFE_B = 0;
  try {
    const pp = getComputedStyle(document.documentElement).getPropertyValue("--sab").trim();
    SAFE_B = parseFloat(pp) || 0;
  } catch(e){ SAFE_B = 0; }
  const UI_BOT = WINH - SAFE_B;          // 底部 UI 的基准线
  if (g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_INTRO){
    const byy = UI_BOT-72;
    outlineText("HP", 14, byy-4, 22, "#ffe678", -1);
    ctx.fillStyle="rgba(40,15,25,0.86)"; ctx.fillRect(46,byy,110,18);
    ctx.fillStyle="#ffc850"; ctx.fillRect(46,byy,110*(g_hp/PLAYER_MAXHP),18);
    ctx.fillStyle="rgba(255,255,200,0.9)"; ctx.fillRect(46,byy,110*(g_hp/PLAYER_MAXHP),6);
    ctx.strokeStyle="rgba(240,240,245,1)"; ctx.lineWidth=1.6; ctx.strokeRect(46,byy,110,18);
    outlineText(`${Math.ceil(g_hp)}/${Math.floor(PLAYER_MAXHP)}`, 160, byy-2, 15, "#fff", -1, false);

    // 按钮（四个常驻显示，仅主菜单可点；整行水平居中）
    const btnKeys=["btn_fight","btn_act","btn_item","btn_mercy"];
    const rowW = 3*102+98;
    const rowX = (WINW-rowW)/2;
    for (let i=0;i<4;++i){
      let bx=rowX+i*102, by=UI_BOT-50, bw=98, bh=34;
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

  renderNetHUD(UI_BOT);   // 联机 HUD：右下角在线人数/队伍/邀请

  // ---- FIGHT 时机条（覆盖在战斗框上，跟随场景偏移）
  if (g_state===ST_FIGHT || (g_state===ST_DMG && g_stateT<0.4)){
    ctx.save(); ctx.translate(VOX,VOY);
    ctx.fillStyle="rgba(10,6,18,0.78)"; ctx.fillRect(250,60,142,190);
    ctx.strokeStyle="#fffafa"; ctx.lineWidth=3; ctx.strokeRect(250,60,142,190);
    ctx.strokeStyle="#ffdc5a"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(321,60); ctx.lineTo(321,250); ctx.stroke();
    if (!g_barHit || g_stateT<0.35){
      ctx.fillStyle="#ff3c3c";
      ctx.fillRect(g_barX-3, 60, 6, 190);
    }
    ctx.restore();
    outlineText(isTouch?"点按屏幕出刀！":"按 Z 出刀！", 0, 256+VOY, 15, "#fff", WINW/2, false);
  }

  // ---- 子菜单（画在战斗框上，跟随场景偏移；热区换算回舞台坐标）
  if (g_state===ST_SUB){
    ctx.save(); ctx.translate(VOX,VOY);
    let opts=[], n=0;
    if (g_sub===SM_ACT){ opts=["检查","安抚"]; n=2; }
    if (g_sub===SM_ITEM){ opts=[g_items?"魔法软糖（回复60）":"（空空如也）"]; n=1; }
    if (g_sub===SM_MERCY){ opts=["饶恕","逃跑"]; n=2; }
    for (let i=0;i<n;++i){
      const y=BOX_Y0+24+i*42;
      outlineText(opts[i], BOX_X0+46, y-10, 22, i===g_subSel?"#fff":"#d8c8d2", -1);
      if (i===g_subSel){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(img("soul"), BOX_X0+26, y, 26,26); ctx.restore(); }
      hot(VOX+BOX_X0+20, VOY+y-22, BOX_X1-BOX_X0-40, 40, ()=>{ g_subSel=i; pressKey("z"); });
    }
    if (g_sub===SM_MERCY && g_spareReady){
      const im=img("sparkle");
      if (im){ ctx.save(); ctx.imageSmoothingEnabled=false;
        drawImg(im, BOX_X1-40, BOX_Y0+30, 36,36, g_animT*160); ctx.restore(); }
      outlineText("!!", BOX_X1-66, BOX_Y0+20, 22, "#ffe65a", -1);
    }
    hot(VOX+BOX_X1-84, VOY+BOX_Y0+8, 72, 30, ()=>pressKey("x"));
    outlineText("返回", BOX_X1-74, BOX_Y0+12, 15, "#9aa8c8", -1, false);
    ctx.restore();
  }

  // ---- 伤害数字（场景坐标）
  ctx.save(); ctx.translate(VOX,VOY);
  for (const d of g_dmg){
    const a=Math.min(1, d.life*2);
    outlineText(d.miss?"MISS":String(d.val), d.x, d.y, 34, d.miss?`rgba(180,180,190,${a})`:`rgba(255,235,80,${a})`, d.x);
  }
  ctx.restore();

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
      : (net.role ? "两个人都倒下了……再试一次？" : "但你还有机会——重新挑战，或者换个对手。");
    outlineText(flavor, 0, 240, 20, "#ebd8c8", WINW/2);
    if ((g_animT%1)<0.65){
      const tip = isMember()
        ? (isTouch?"点按屏幕 退出队伍":"Enter 退出队伍")
        : (isTouch?"点按屏幕 重新挑战":"Z 重新挑战　　ESC 返回主界面");
      outlineText(tip, 0, 330, 22, "#fff", WINW/2);
    }
    if (!isMember()) hot(0,0,WINW,WINH,()=>pressKey("z"));
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

  // ---- 暂停按钮（战斗中右上角；联机时所有人都能开面板）
  if (g_state>=ST_INTRO && g_state!==ST_WIN && g_state!==ST_LOSE){
    btnPause();
  }

  // ---- 联机：等队友出刀（贴战斗框底部，不压 Boss；这里的坐标是舞台系，要补 VOX/VOY）
  if (g_state===ST_WAIT && !g_dead){
    const dots=".".repeat(1+Math.floor(g_animT*2)%3);
    const bx0=VOX+BOX_X0, bx1=VOX+BOX_X1, bh=54, by=VOY+BOX_Y1-bh;
    ctx.fillStyle="rgba(8,6,16,0.55)"; ctx.fillRect(bx0,by,bx1-bx0,bh);
    ctx.strokeStyle="rgba(255,210,87,0.35)"; ctx.lineWidth=1; ctx.strokeRect(bx0,by,bx1-bx0,bh);
    outlineText("等待队友出刀"+dots, 0, by+6, 22, "#ffd257", VOX+BOX_CX);
    outlineText(isTouch?"点右上角暂停键可退出队伍":"ESC 打开暂停菜单（可退出）", 0, by+33, 12, "#9fb4e8", VOX+BOX_CX, false);
  }

  // ---- 联机：阵亡选择（退出 / 观战）
  if (net.role && g_dead && !g_deadChoice && g_state!==ST_LOSE && g_state!==ST_TITLE){
    ctx.fillStyle="rgba(6,4,12,0.74)"; ctx.fillRect(0,0,WINW,WINH);
    outlineText("你 倒 下 了", 0, WINH*0.30, 44, "#ff6a6a", WINW/2);
    const labels=[isMember()?"退出队伍":"退出战斗", "观战"];
    const bw=Math.min(150, WINW*0.30), gap=22, total=bw*2+gap, x0=WINW/2-total/2;
    for (let i=0;i<2;++i){
      const bx=x0+i*(bw+gap), by=WINH*0.42;
      ctx.fillStyle = g_deadSel===i?"rgba(86,116,226,0.92)":"rgba(28,24,46,0.94)";
      ctx.fillRect(bx,by,bw,52);
      ctx.strokeStyle = g_deadSel===i?"#ffffff":"#7a86aa"; ctx.lineWidth=2;
      ctx.strokeRect(bx,by,bw,52);
      outlineText(labels[i], 0, by+16, 21, "#fff", bx+bw/2);
      hot(bx-6,by-6,bw+12,64,()=>{ playSfx("snd_menu_select"); if (i===0) deadQuit(); else deadSpectate(); });
    }
    if (!isTouch) outlineText("← → 选择　Z 确认", 0, WINH*0.42+70, 14, "#c9d2e8", WINW/2, false);
  } else if (net.role && g_dead && g_deadChoice && g_state!==ST_LOSE){
    rightText("观战中 · 暂停键退出", WINW-10, 46, 12, "#8fa0c8");
  }

  // ---- 联机暂停面板（不冻结游戏，盖在最上层）
  if (g_pauseUI) RenderPauseUI();

  // ---- 操作提示
  if (g_state===ST_MENU && !isTouch)
    outlineText("方向键选择  Z确认  X取消", 12, 10, 15, "#b4d2ff", -1, false);
}

function RenderPauseUI(){
  const py=VOY;
  ctx.fillStyle="rgba(0,0,0,0.74)"; ctx.fillRect(0,0,WINW,WINH);
  outlineText("暂　停", 0, 44+py, 44, "#ffec78", WINW/2);
  outlineText("联机中：画面不会停，队友仍在行动", 0, 96+py, 13, "#9fb4e8", WINW/2, false);

  outlineText("继续游戏", 0, 146+py, 22, g_pauseSel===0?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===0){ ctx.save(); ctx.imageSmoothingEnabled=false;
    drawImg(img("soul"), WINW/2-96, 157+py, 20,20); ctx.restore(); }
  hot(WINW/2-140, 136+py, 280, 46, ()=>{ playSfx("snd_menu_select"); closePause(); });

  outlineText(`音量　　${g_vol}%`, 0, 206+py, 22, g_pauseSel===1?"#fff":"#c2becd", WINW/2);
  const bx=WINW/2-90, by=242+py, bw=180, bh=10;
  ctx.fillStyle="rgba(60,60,90,0.9)"; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle="#78d2ff"; ctx.fillRect(bx,by,bw*g_vol/100,bh);
  ctx.strokeStyle="rgba(200,200,240,0.5)"; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,bh);
  btn(bx-64, by-13, 44, 32, "－", ()=>{ g_vol=clamp(g_vol-10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  btn(bx+bw+20, by-13, 44, 32, "＋", ()=>{ g_vol=clamp(g_vol+10,0,100); bgm.volume=g_vol/100; playSfx("snd_menu_move"); });
  hot(bx-10, by-20, bw+20, 40, ()=>{ g_pauseSel=1; });

  outlineText(isMember()?"退出队伍":"退出战斗", 0, 302+py, 22, g_pauseSel===2?"#fff":"#c2becd", WINW/2);
  if (g_pauseSel===2){ ctx.save(); ctx.imageSmoothingEnabled=false;
    drawImg(img("soul"), WINW/2-96, 313+py, 20,20); ctx.restore(); }
  hot(WINW/2-140, 292+py, 280, 46, ()=>{ playSfx("snd_menu_select"); closePause();
    if (isMember()) netLeave(); else GoTitle(); });
}

function btnPause(){
  const x=WINW-44, y=10, w=34, h=30;
  ctx.fillStyle="rgba(20,14,40,0.6)";
  ctx.strokeStyle="rgba(200,200,255,0.5)"; ctx.lineWidth=1.5;
  roundRect(x,y,w,h,7); ctx.fill(); ctx.stroke();
  ctx.fillStyle="rgba(240,240,255,0.9)";
  ctx.fillRect(x+10,y+7,4,h-14); ctx.fillRect(x+20,y+7,4,h-14);
  hot(x-8,y-8,w+16,h+16, openPause);
}

// ---- 场内战预告（攻击阶段每帧绘制，不只在开场预警窗口）
function drawGridWarn(){
  ctx.strokeStyle="rgba(255,140,190,0.26)";
  ctx.lineWidth=1;
  ctx.setLineDash([4,6]);
  for (let i=0;i<=4;++i){
    const x=BOX_X0+i*(BOX_X1-BOX_X0)/4;
    const y=BOX_Y0+6+i*(BOX_Y1-BOX_Y0-12)/4;
    ctx.beginPath(); ctx.moveTo(x,BOX_Y0+4); ctx.lineTo(x,BOX_Y1-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(BOX_X0+4,y); ctx.lineTo(BOX_X1-4,y); ctx.stroke();
  }
  ctx.setLineDash([]);
  const cb0=img("catbomb");
  for (const w of g_gridWarn){
    const cw=(BOX_X1-BOX_X0-100)/3, ch=(BOX_Y1-BOX_Y0-44)/3;
    const bx=BOX_X0+50+w.gx*cw, by=BOX_Y0+22+w.gy*ch;
    const blink=Math.sin(g_animT*20)>0;
    const a=blink?0.42:0.22;
    // 待爆的整行 + 整列
    ctx.fillStyle=`rgba(255,50,105,${a})`;
    ctx.fillRect(BOX_X0, by-ch/2, BOX_X1-BOX_X0, ch);
    ctx.fillRect(bx-cw/2, BOX_Y0, cw, BOX_Y1-BOX_Y0);
    ctx.fillStyle=`rgba(255,225,240,${a*0.5})`;
    for (let sy=by-ch/2; sy<by+ch/2; sy+=6) ctx.fillRect(BOX_X0, sy, BOX_X1-BOX_X0, 1.5);
    for (let sx=bx-cw/2; sx<bx+cw/2; sx+=6) ctx.fillRect(sx, BOX_Y0, 1.5, BOX_Y1-BOX_Y0);
    // 格子描边 + 炸弹图标
    ctx.strokeStyle=`rgba(255,255,255,${blink?0.95:0.55})`;
    ctx.lineWidth=2;
    ctx.strokeRect(bx-cw/2, by-ch/2, cw, ch);
    if (cb0){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(cb0,bx,by,34,34,g_animT*180); ctx.restore(); }
  }
}

function drawSignalWarn(){
  const gapY=BOX_CY+Math.sin(g_waveN*1.15)*50;
  const side=g_warnSide||0;
  ctx.fillStyle="rgba(120,255,190,0.18)";
  ctx.fillRect(BOX_X0, gapY-38, BOX_X1-BOX_X0, 76);
  ctx.strokeStyle=`rgba(150,255,210,${(140+90*Math.abs(Math.sin(g_animT*6)))/255})`;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(BOX_X0+4,gapY-38); ctx.lineTo(BOX_X1-4,gapY-38);
  ctx.moveTo(BOX_X0+4,gapY+38); ctx.lineTo(BOX_X1-4,gapY+38);
  ctx.stroke();
  const ph=img("phone");
  if (ph){ ctx.save(); ctx.imageSmoothingEnabled=false;
    for (let y=BOX_Y0+10; y<=BOX_Y1-10; y+=20){
      if (Math.abs(y-gapY)<38) continue;
      drawImg(ph, side===0?BOX_X0+18:BOX_X1-18, y, 26,26, 0);
    } ctx.restore(); }
  for (let i=0;i<4;++i){
    const sy=BOX_Y0+((g_animT*44+i*28)%(BOX_Y1-BOX_Y0));
    ctx.strokeStyle="rgba(180,255,220,0.20)";
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(BOX_X0+2,sy); ctx.lineTo(BOX_X1-2,sy); ctx.stroke();
  }
}

function drawBoltWarn(){
  ctx.strokeStyle=`rgba(200,230,255,${(110+120*Math.abs(Math.sin(g_animT*9)))/255})`;
  ctx.lineWidth=1.5;
  ctx.setLineDash([7,7]);
  ctx.beginPath(); ctx.moveTo(g_warnX,BOX_Y0); ctx.lineTo(g_warnX,BOX_Y1); ctx.stroke();
  ctx.setLineDash([]);
  const ph=img("phone");
  if (ph){ ctx.save(); ctx.imageSmoothingEnabled=false;
    drawImg(ph,g_warnX,BOX_Y0+16,30,30,Math.sin(g_animT*22)*14); ctx.restore(); }
}

// ---------------- 联机 HUD ----------------
function soulBlueImg(){
  if (net._soulBlue) return net._soulBlue;
  const s=img("soul"); if (!s || !s.naturalWidth) return null;
  try{
    const c=document.createElement("canvas");
    c.width=s.naturalWidth; c.height=s.naturalHeight;
    const c2=c.getContext("2d");
    c2.filter="hue-rotate(215deg) saturate(1.5)";
    c2.drawImage(s,0,0);
    c2.filter="none";
    net._soulBlue=c; return c;
  }catch(e){ return null; }
}
function mySoulImg(){ return isMember() ? (soulBlueImg()||img("soul")) : img("soul"); }
function partnerSoulImg(){ return isMember() ? img("soul") : (soulBlueImg()||img("soul")); }

function renderNetHUD(uiBot){
  if (!net.on && !net.role) return;          // 离线且未组队时不显示
  // ---- 邀请横幅（顶部）
  if (net.invite){
    const bw=340, bx=WINW/2-bw/2, by=8;
    ctx.fillStyle="rgba(30,14,40,0.93)"; ctx.fillRect(bx,by,bw,46);
    ctx.strokeStyle="#ff88b0"; ctx.lineWidth=2; ctx.strokeRect(bx,by,bw,46);
    outlineText(net.invite.n+" 邀请你组队！", 0, by+6, 16, "#ffd6e4", WINW/2, false);
    if (isTouch){
      outlineText("[接受]", bx+74, by+25, 15, "#8cffb0", -1, false);
      outlineText("[拒绝]", bx+bw-74, by+25, 15, "#ff9c9c", -1, false);
      hot(bx+34, by+20, 80, 26, netAcceptInvite);
      hot(bx+bw-114, by+20, 80, 26, netDeclineInvite);
    } else outlineText("Enter 同意 · X 拒绝", 0, by+25, 13, "#c9d2e8", WINW/2, false);
  } else if (net.invSent && (g_state===ST_TITLE||g_state===ST_MENU)){
    outlineText("已发出组队邀请，等待回应…", 0, 10, 14, "#c9d2e8", WINW/2, false);
  }
  // ---- 右下角在线人数 / 队伍状态（右对齐，自动避让底部按钮行）
  const oc=netOnline();
  const lh=17;
  const inBattle = uiBot!==undefined && g_state!==ST_TITLE && g_state!==ST_MENU;
  const bot = inBattle ? uiBot-56 : WINH-14;          // 区块底边
  const nLines = 1 + (net.role ? (isTouch?2:1) : 0);
  const hy = bot - (15 + (nLines-1)*lh);
  const st = net.on ? (net.role ? "#ffd257" : "#7dffa8") : "#8a8a9a";
  rightText((net.on?"● ":"○ ")+"在线 "+oc, WINW-10, hy, 15, st);
  if (net.role){
    const tag = (isLeader() ? "红心·队长" : "蓝心·队员") + (net.dcOk ? " ·直连" : " ·中转");
    rightText(tag+"  与 "+net.partnerName, WINW-10, hy+lh, 12, "#c9d2e8");
    if (isTouch) rightText("点此退队", WINW-10, hy+lh*2, 11, "#8fa0c8");
    if (isTouch) hot(WINW-196, hy+lh-4, 190, lh*(isTouch?2:1)+4, netLeave);   // 手机：点队伍状态退队
  }
  // 在线人数可点（开/关玩家面板）
  if (g_state===ST_TITLE || g_state===ST_MENU)
    hot(WINW-150, hy-8, 144, 26, ()=>{ net.panel=!net.panel; net.selIdx=0; });
  // ---- 玩家面板
  if (net.panel && (g_state===ST_TITLE||g_state===ST_MENU)){
    const L=netLobbyList();
    const pw=300, rowH=30, head=52, foot=26;
    const ph=head + Math.max(1,Math.min(L.length,6))*rowH + foot;
    const px0=WINW-pw-16, py0=Math.max(8, hy-ph-10);
    ctx.fillStyle="rgba(12,9,24,0.95)"; ctx.fillRect(px0,py0,pw,ph);
    ctx.strokeStyle="rgba(140,160,220,0.85)"; ctx.lineWidth=1.5; ctx.strokeRect(px0,py0,pw,ph);
    outlineText("在线玩家（Tab 切换 · Enter 邀请）", px0+14, py0+12, 13, "#9fb4e8", -1, false);
    let rowY=py0+head-12;
    if (net.role) outlineText("已在队伍中（Enter 退出）", px0+16, rowY, 14, "#ffd257", -1, false);
    else if (!L.length) outlineText("暂无可邀请的玩家", px0+16, rowY, 14, "#8a92b0", -1, false);
    for (let i=0;i<L.length && i<6;++i){
      const sel=(net.selIdx-1)===i;
      if (sel){ ctx.fillStyle="rgba(80,110,220,0.38)"; ctx.fillRect(px0+8,rowY-5,pw-16,26); }
      ctx.fillStyle = sel?"#8cffb0":"#9aa4c0";
      ctx.beginPath(); ctx.arc(px0+20,rowY+4,4,0,6.29); ctx.fill();   // 在线小圆点
      outlineText((sel?"▶ ":"　 ")+L[i].n, px0+32, rowY, 15, sel?"#ffffff":"#cfd6ea", -1, false);
      if (sel) outlineText("Enter", px0+pw-58, rowY, 12, "#8cffb0", -1, false);
      hot(px0+8, rowY-5, pw-16, 26, ()=>{ net.selIdx=i+1; netSendInvite(L[i].cid); });
      rowY+=rowH;
    }
    outlineText(isTouch?"点玩家名即可邀请":"Tab 切换 · Enter 发邀请", px0+16, py0+ph-20, 12, "#7e86a4", -1, false);
    rightText("本机 "+net.cid.slice(2,6).toUpperCase(), px0+pw-12, py0+ph-20, 11, "#6d7698");
  }
  // ---- 队友 HP（叠在自己 HP 条上方，避开底部按钮行）
  if (net.role && net.php!==undefined && uiBot!==undefined && g_state!==ST_TITLE){
    const pw=Math.max(0,Math.min(1,net.php/PLAYER_MAXHP));
    const ty=uiBot-94;
    outlineText("队友 "+net.partnerName, 46, ty-15, 11, "#9fb4e8", -1, false);
    ctx.fillStyle="rgba(10,14,30,0.86)"; ctx.fillRect(46,ty,110,9);
    ctx.fillStyle=isMember()?"#ff8f8f":"#5f9dff";
    ctx.fillRect(46,ty,110*pw,9);
    ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.fillRect(46,ty,110*pw,3);
    ctx.strokeStyle="rgba(200,215,255,0.9)"; ctx.lineWidth=1; ctx.strokeRect(46,ty,110,9);
  }
}

// ---- 预警图形（每个招式）
function renderWarn(pulse){  switch (g_pattern){
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
  case P_DEAL: {  // All-Star Cast：星星环穿 + 屏幕明暗
    const dim=0.22+0.13*Math.sin(g_animT*7);
    ctx.fillStyle=`rgba(6,2,16,${dim})`;
    ctx.fillRect(0,0,640,480);
    const st=img("star");
    // 环绕星星
    if (st){ ctx.save(); ctx.imageSmoothingEnabled=false;
      for (let i=0;i<8;++i){
        const a=g_animT*2.4+i*0.7854;
        drawImg(st, BOX_CX+Math.cos(a)*176, BOX_CY+Math.sin(a)*74, 30,30, g_animT*260);
      } ctx.restore(); }
    // 四边射出箭头提示
    ctx.strokeStyle=`rgba(255,225,140,${(120+110*pulse)/255})`;
    ctx.lineWidth=2.5;
    for (let i=0;i<3;++i){
      const y=BOX_Y0+22+i*(BOX_Y1-BOX_Y0-44)/2;
      const k=((g_animT*1.1+i*0.33)%1);
      const x0=BOX_X0+6+k*26;
      ctx.beginPath();
      ctx.moveTo(x0,y-7); ctx.lineTo(x0+9,y); ctx.lineTo(x0,y+7);
      ctx.moveTo(BOX_X1-6-k*26,y-7); ctx.lineTo(BOX_X1-15-k*26,y); ctx.lineTo(BOX_X1-6-k*26,y+7);
      ctx.stroke();
    }
    ctx.strokeStyle=`rgba(255,230,160,${(90+100*pulse)/255})`;
    ctx.lineWidth=2;
    ctx.strokeRect(BOX_X0,BOX_Y0,BOX_X1-BOX_X0,BOX_Y1-BOX_Y0);
    break; }
  case P_MAIL: { drawBoltWarn(); break; }
  case P_CALL: {  // Rimshot：反弹星 + 五点散弹
    const st=img("star");
    if (st){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(st,BOX_X0+34,BOX_Y0+34,26,26,g_animT*300);
      drawImg(st,BOX_X1-34,BOX_Y1-34,26,26,-g_animT*300);
      ctx.restore(); }
    ctx.fillStyle=`rgba(255,220,120,${(120+120*pulse)/255})`;
    for (let i=0;i<5;++i){
      const a=g_animT*3+i*1.2566;
      ctx.beginPath();
      ctx.arc(BOX_CX+Math.cos(a)*46, BOX_CY+Math.sin(a)*36, 5,0,6.29); ctx.fill();
    }
    break; }
  case P_KROMER: { drawSignalWarn(); break; }
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
  case P_MAGIC: {  // 三车道 + 爱心
    const lanes=[BOX_Y0+22, BOX_CY, BOX_Y1-22];
    const gap=Math.floor(g_animT*1.4)%3;
    const wc=img("whitecat"), ht=img("heart");
    for (let i=0;i<3;++i){
      const y=lanes[i];
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
    if (ht){ ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(ht,BOX_X0+30,BOX_CY+Math.sin(g_animT*4)*8,24,24,0); ctx.restore(); }
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
  case P_MEOW: { drawGridWarn(); break; }
  case P_GHOST: {  // 雷达圈
    const rr=20+((g_animT*60)%70);
    const fade=Math.max(0,1-rr/90);
    ctx.strokeStyle=`rgba(255,170,220,${fade})`;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(BOX_CX,BOX_CY,rr,rr*0.6,0,0,6.29); ctx.stroke();
    ctx.strokeStyle=`rgba(255,170,220,${fade*0.6})`;
    ctx.beginPath(); ctx.ellipse(BOX_CX,BOX_CY,rr*0.55,rr*0.33,0,0,6.29); ctx.stroke();
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
  netTick();
  Render();
  requestAnimationFrame(loop);
}
// 心跳/同步独立于动画帧：窗口被遮挡或切到后台时浏览器会暂停 rAF，
// 联机心跳不能跟着停（否则另一个窗口会看不到你这个玩家）
setInterval(()=>{ try{ netTick(); }catch(e){} }, 250);

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
