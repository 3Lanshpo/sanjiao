// =====================================================================
//  小丑魔战斗 网页版 —— 由 C++/Win32 版完整移植
//  HTML5 Canvas + Web Audio，支持手机触屏操作
// =====================================================================
'use strict';

// ---------------- 常量 ----------------
const GAME_VER = "20261109d";        // 改这里 + index.html 的 ?v= 才能让浏览器拉新版
let WINW = 640, WINH = 480;      // 舞台逻辑尺寸：随屏幕比例扩展（横屏加宽/竖屏加高）
let VOX = 0, VOY = 0;            // 640x480 游戏场景在舞台中的偏移
const BOX_X0 = 120, BOX_Y0 = 278, BOX_X1 = 520, BOX_Y1 = 418;
const BOX_CX = (BOX_X0 + BOX_X1) * 0.5, BOX_CY = (BOX_Y0 + BOX_Y1) * 0.5;
// 场上站位：战斗框上沿就是「地面」，角色与 Boss 都踩在这条线上
const GROUND_Y = 272;
const P_HOME_X = 434;            // Boss 站在右侧
let JEV_CX = P_HOME_X, JEV_CY = 188;   // Boss 中心（layoutFighters 按立绘高度重算）
let JEV_W = 158, JEV_H = 168;
const HEART_SPD = 185.0;
const PLAYER_MAXHP = 120.0;

// 状态
const ST_TITLE=0, ST_PAUSE=1, ST_INTRO=2, ST_MENU=3, ST_SUB=4,
      ST_FIGHT=5, ST_DMG=6, ST_DIALOG=7, ST_ATTACK=8, ST_WIN=9, ST_LOSE=10,
      ST_WAIT=11,                     // 联机：我已出刀，等队友出刀
      ST_CREATE=12,                   // 首次进入：起名 + 设密码 + 选外貌
      ST_LOGIN=13,                    // 登录：邮箱 + 密码（云端账号）
      ST_SETPWD=14,                   // 给当前存档补设 / 修改密码（老存档没密码时用）
      ST_SPARE=15,                    // 饶恕结算：不是胜利、不掉道具，只在卡牌下标「饶恕」
      ST_SYNC=16,                     // 存档搬运：导出 / 导入一盘存档码（换电脑用）
      ST_SIGNUP=17;                   // 注册 / 重设密码：邮箱验证码 + 密码
// 我的房间：独立场景，不参与战斗状态机。用负数，避免命中所有 g_state>=ST_INTRO 的战斗判断
const ST_ROOM=-1;
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
const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints>0;   // 提前定义：fitCanvas 里要用
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

// 道具运行时：已用次数（每局/每回合重置）+ 本回合生效的增益 + 刚掉落的道具
let g_gearUse = { scythe:0, tv:0, fuse:0, guitar:0 };
let g_buff    = { scythe:false, tv:false, fuse:false, guitar:0,
                  weaken:0, regen:0, chill:false };   // 技能：减攻系数 / 药水剩余回合 / 难度回初始
let g_skillUse = 0;            // 角色专属技能本局已用次数（每局一次，ResetGame 清零）

// ---------------- 我的房间（空房间：白墙 + 木地板，角色用原版 overworld 走路帧） ----------------
const ROOM_WALL_Y   = 96;                   // 白墙与木地板的分界（宝可梦视角：墙只占上面一窄条）
const ROOM_SPD      = 170;                  // 房间里的移动速度（像素/秒）
const TILE          = 40;                   // 房间格子边长（与地板瓷砖一致）
const BAG_H         = 62;                   // 底部背包栏高度
// 家具表：w/h = 未旋转时占的格数（桌子 5×2=10、电视机 3×2=6、沙发 5×2=10、空调/台灯 1×1）
// surface = 这件家具的桌面能摆东西；stack = 这件能摆到桌面上；sw = 能靠近按 E 开关
// img = assets/ 里的像素素材（OpenGameArt "Cozy Space Furniture" by Bramble & Byte, CC BY 4.0）
const FURN = [
  { kind:"table", name:"桌子",   w:5, h:2, img:"furn_table", surface:true },
  { kind:"tv",    name:"电视机", w:3, h:2, img:"furn_tv",    stack:true },
  { kind:"sofa",  name:"沙发",   w:5, h:2, img:"furn_sofa" },
  { kind:"ac",    name:"空调",   w:1, h:1, img:"furn_ac",    sw:true },
  { kind:"lamp",  name:"台灯",   w:1, h:1, img:"furn_lamp",  sw:true, stack:true },
  { kind:"clear", name:"清除",   w:1, h:1, img:"furn_bin", clear:true },   // 清除工具：点家具就拆掉
];
let g_room = { x:WINW/2, y:Math.round(WINH*0.78), face:1, t:0, moving:false };
let g_roomFurn = [];        // 已经摆好的家具：{kind, gx, gy, rot}
let g_hold     = null;      // 手上拎着的家具：{kind, rot}
let g_mouse    = { x:WINW/2, y:Math.round(WINH*0.6) };   // 房间里的指针位置（放置预览用）
let g_lastDrop = "";
let g_toast = null;            // {txt, t, col}：屏幕上短暂提示（道具生效等）

// ---------------- 存档：玩家档案（名字 + 外貌） ----------------
// 存在 localStorage 里，下次进来直接进标题，不再问名字。
const SAVE_KEY = "sanjiao_profile_v1";
const CHARS = [
  // img/frames = 待机动画；atk/atkN = 原版挥刀动画（攻击时整段替换）
  // spd/dmg/maxhp = 角色被动：移动速度倍率 / 造成伤害倍率 / 血量上限
  { key:"kris",   label:"KRIS",   img:"char_kris",   frames:6, atk:"atk_kris",   atkN:7, atkS:1.00,
    spd:1.20, dmg:1.00, maxhp:120, passive:"移动速度 +20%" },
  { key:"susie",  label:"SUSIE",  img:"char_susie",  frames:4, atk:"atk_susie",  atkN:6, atkS:1.50,
    spd:1.00, dmg:1.20, maxhp:120, passive:"造成伤害 +20%" },
  { key:"ralsei", label:"RALSEI", img:"char_ralsei", frames:5, atk:"atk_ralsei", atkN:6, atkS:1.70,
    spd:1.00, dmg:1.00, maxhp:150, passive:"血量上限 150" },
];
// 当前角色的被动（没选外貌时按 KRIS 算）
function myChar(){
  const i = g_profile.skin|0;
  return (i>=0 && i<CHARS.length) ? CHARS[i] : CHARS[0];
}
function maxHp(){ return myChar().maxhp || PLAYER_MAXHP; }
function heartSpd(){ return HEART_SPD * (myChar().spd || 1); }
function dmgMul(){ return myChar().dmg || 1; }
function skillDmg(sk){ return sk.dmg>0 ? Math.round(sk.dmg*dmgMul()) : 0; }
function skillLine(sk, d){ return sk.line.replace("{d}", String(d)); }
function skillPerTxt(sk){ return sk.perTxt.replace("{d}", String(skillDmg(sk))); }
// ---------------- 角色专属技能（按外貌索引，消耗一回合行动） ----------------
// 联机：伤害走 act 消息由队长权威扣血；附加效果走 sk 消息，除粗暴砍击外都对队友生效。
const SKILLS = [
  { key:"sword", name:"胜利之剑", col:"#ff9ab8",
    dmg:60,  perTxt:"耗1回合 · {d}伤害 · 敌攻-50%",
    line:"胜利之剑！光刃劈开混沌！（{d} 伤害，本回合受到的伤害减半）" },
  { key:"chop",  name:"粗暴砍击", col:"#ffb35a",
    dmg:110, perTxt:"耗1回合 · {d}伤害",
    line:"粗暴砍击！！（{d} 伤害）" },
  { key:"potion",name:"神奇药水", col:"#8fe6a0",
    dmg:0,   perTxt:"耗1回合 · 3回合×30HP",
    line:"神奇药水！暖流涌上来……（接下来 3 回合每回合回复 30 HP）" },
];
function mySkill(){ return SKILLS[clamp(g_profile.skin|0, 0, SKILLS.length-1)]; }
const SKILL_PER_RUN = 1;                       // 每局只能用一次
function skillLeft(){ return Math.max(0, SKILL_PER_RUN - g_skillUse); }
// ---------------- 道具（打赢 Boss 掉落） ----------------
// per:"run" = 整场战斗限次；per:"turn" = 每回合限次（回合切换时恢复）
const ITEMS = [
  { key:"scythe", boss:0, name:"恶魔镰刀", short:"镰刀", color:"#c887ff",
    per:"run",  max:1, perTxt:"本局一次", desc:"这次出刀伤害翻倍" },
  { key:"tv",     boss:1, name:"电视机",   short:"电视", color:"#6fe0ff",
    per:"run",  max:1, perTxt:"本局一次", desc:"本回合受击 30% 概率免伤" },
  { key:"fuse",   boss:2, name:"引线",     short:"引线", color:"#ffa14a",
    per:"run",  max:1, perTxt:"本局一次", desc:"本回合受到的伤害 -30%" },
  { key:"guitar", boss:3, name:"电吉他",   short:"吉他", color:"#ff7ac8",
    per:"turn", max:2, perTxt:"每回合 2 次", desc:"每次弹幕 -50%，两次静音" },
];
const ItemByKey = k => ITEMS.find(i=>i.key===k);

let g_profile = { name:"", skin:-1, cleared:[false,false,false,false], spared:[false,false,false,false], pwd:"" };
let g_accountKey = "";        // 当前账号在账号表里的键（= 玩家名）
let g_createStage = 0;        // 0 = 起名，1 = 设密码，2 = 选外貌
let g_createSel = 0;          // 外貌光标
let g_createPwd = "";         // 新建存档时输入的密码（明文，仅用于本轮）
let g_createName = "";        // 起名页里正在输入的名字（确认前不写进档案）
let g_createNew = true;       // true = 新建存档（要设密码），false = 标题点头像改名
let g_createErr = "";
let g_backup = null;          // 从登录页点「新建存档」前的账号快照，B 可以反悔退回去
let g_nameBlink = 0;
// 登录页状态
let g_login = { user:"", pwd:"", sel:0, err:"", ok:"", lock:false };
// 设密码页状态（给无密码的老存档补一个 / 改密码）
let g_setpwd = { pwd:"", pwd2:"", sel:0, err:"", ok:"" };
// 存档搬运页状态（0=导出，1=导入）
let g_sync = { tab:0, who:"", code:"", err:"", over:"", ok:"" };

// ---------------- 账号（一个浏览器可存多份存档） ----------------
// 新存档 = 名字 + 密码 + 外貌 + 通关记录；进去要登录。
// 老版本的存档没有密码，自动迁移成「无密码账号」，启动时直接进（不弹登录）。
const ACC_KEY = "sanjiao_accounts_v1";
const CUR_KEY = "sanjiao_current_v1";
const DEV_KEY = "sanjiao_device_v1";        // 这台设备已登录过的账号：下次打开直接进，不再问密码

// 同机免登录：登录成功（或刚设好密码）就在本机记一笔。
// 只认「这台浏览器 + 这个账号」；换账号仍要输密码，清缓存后也会重新要求登录。
function trustDevice(u){
  if (!u) return;
  try { localStorage.setItem(DEV_KEY, JSON.stringify({ u, t: Date.now() })); } catch(e){}
}
function isTrustedDevice(u){
  if (!u) return false;
  try {
    const o = JSON.parse(localStorage.getItem(DEV_KEY) || "null");
    return !!(o && o.u === u);
  } catch(e){ return false; }
}
function clearTrustDevice(){
  try { localStorage.removeItem(DEV_KEY); } catch(e){}
}

function hashPwd(s){                        // 本地存档用，不追求密码学强度，只为不存明文
  let h = 2166136261; s = "sj$" + (s||"");
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h>>>0).toString(36);
}
function loadAccounts(){
  try {
    const raw = localStorage.getItem(ACC_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return (o && typeof o==="object") ? o : {};
  } catch(e){ return {}; }
}
function saveAccounts(o){ try { localStorage.setItem(ACC_KEY, JSON.stringify(o)); } catch(e){} }
function currentUserName(){ try { return localStorage.getItem(CUR_KEY) || ""; } catch(e){ return ""; } }
function setCurrentUser(u){ try { localStorage.setItem(CUR_KEY, u||""); } catch(e){} }
function accountToProfile(a){
  const cl = Array.isArray(a.cleared) ? a.cleared : [];
  const sp = Array.isArray(a.spared) ? a.spared : [];
  return { name: a.name||"", skin: (a.skin|0), pwd: a.pwd||"",
           cleared: [0,1,2,3].map(i=>!!cl[i]),
           spared:  [0,1,2,3].map(i=>!!sp[i]) };
}
function currentAccount(){                   // 当前登录的账号（没登录/没存档 → null）
  const u = currentUserName();
  const a = loadAccounts();
  return (u && a[u]) ? { user:u, acc:a[u] } : null;
}
function loadProfile(){                      // 启动时把当前账号载进 g_profile（含旧存档迁移）
  const accounts = loadAccounts();
  const cur = currentUserName();
  if (cur && accounts[cur]){
    g_accountKey = cur;
    g_profile = accountToProfile(accounts[cur]);
    return true;
  }
  // 旧存档迁移：老版本只存了一份 profile，没有账号表、没有密码
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    if (!p || typeof p.name !== "string" || !p.name.trim()) return false;
    const skin = p.skin|0;
    if (!(skin>=0 && skin<CHARS.length)) return false;
    const cl = Array.isArray(p.cleared) ? p.cleared : [];
    const acc = { name: p.name.trim().slice(0,12), skin, pwd:"",
                  cleared: [0,1,2,3].map(i=>!!cl[i]),
                  spared:  [false,false,false,false] };
    accounts[acc.name] = acc;
    saveAccounts(accounts);
    setCurrentUser(acc.name);
    g_accountKey = acc.name;
    g_profile = accountToProfile(acc);
    return true;
  } catch(e){ return false; }
}
function saveProfile(){                      // 写回当前账号（同时保留旧 key，兼容老页面）
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g_profile));
    const u = g_accountKey || g_profile.name;
    if (!u) return;
    const accounts = loadAccounts();
    accounts[u] = { name: g_profile.name, skin: g_profile.skin,
                    cleared: (g_profile.cleared||[false,false,false,false]).slice(0,4),
                    spared: (g_profile.spared||[false,false,false,false]).slice(0,4),
                    pwd: g_profile.pwd || (accounts[u] && accounts[u].pwd) || "" };
    saveAccounts(accounts);
    setCurrentUser(u);
    if (g_cloud.uid) cloudPushSoon();          // 云端账号：改动排队上传
  } catch(e){}
}
function applyAccount(u){                    // 切到某个账号
  const a = loadAccounts()[u];
  if (!a) return false;
  g_accountKey = u;
  g_profile = accountToProfile(a);
  setCurrentUser(u);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(g_profile)); } catch(e){}
  net.name = g_profile.name;
  try { localStorage.setItem("sj_name", net.name); } catch(e){}
  avatarLayout();
  if (net.on) netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s:"lobby", ts:Date.now(), i:net.inst, k:g_profile.skin});
  return true;
}

// ---------------- 云账号（存档跟着账号走） ----------------
// 账号存在 WorkBuddy 云服务里，用「邮箱 + 密码」登录：换电脑/换浏览器只要输一次就能把存档拉下来。
// 本机的账号表退化成缓存（键是 "u:" + 云端用户 id），所以断网也能接着玩，联网后自动补传。
// 云端表 saves：一行一个用户，owner_id 由 DEFAULT auth.uid() 填、RLS 只让自己读改。
const CLOUD_TABLE = "saves";
const LOGOUT_KEY = "sanjiao_logout_v1";       // 主动退过账号：下次打开先停在登录页
let g_boot = false;                           // 开机连接云端时的中转界面
let g_cloud = {
  uid:"", email:"", busy:false, ok:"", err:"",
  pushT:0, pushAt:0, dirty:false, lastErr:""
};
function cloudClient(){
  try { return window.__cloud || null; } catch(e){ return null; }
}
async function waitCloud(ms){                 // 等 SDK 到位（最多 ms 毫秒）
  const t0 = performance.now();
  while (!cloudClient() && performance.now() - t0 < ms)
    await new Promise(r=>setTimeout(r, 120));
  return cloudClient();
}
function cloudErrText(e, fallback){
  const k = (e && (e.kind || e.code || "")) + "";
  const m = (e && (e.message || e.error_description || e.msg || "")) + "";
  const s = (k + " " + m).toLowerCase();
  if (/network|fetch|timeout|failed to fetch|abort/.test(s)) return cloudHostOk()
    ? "连不上云端，检查一下网络再试"
    : "这个网址不支持云账号，请用 WorkBuddy 分享链接";
  if (/invalid_username_or_password|invalid.*credential|invalid_grant|unauthenticated|incorrect/.test(s)) return "邮箱或密码不对";
  if (/user.*not.*found|no.*user|not.*registered/.test(s)) return "这个邮箱还没注册过，点「注册」";
  if (/rate|too many|429/.test(s)) return "试得太频繁了，等一会儿再来";
  if (/otp|token|verification|expired|invalid.*code/.test(s)) return "验证码不对或已过期，重新发一次";
  return (m || k || fallback || "云服务出错，稍后再试").replace(/\s+/g," ").slice(0, 64);
}
function cloudEmailOk(s){ return /^[^@\s]{1,64}@[^@\s.]{1,64}\.[^@\s]{2,}$/.test((s||"").trim()); }
// 云服务端按发布公钥做精确 Origin 校验：只有本应用保留域名（和本地调试）能用云账号
const CLOUD_HOST = "chaos-boss-battle.app.workbuddy.host";
const CLOUD_URL  = "https://chaos-boss-battle.app.workbuddy.host/?sharecode=7RKWIXSBZX";
function cloudHostOk(){
  try {
    const h = String(location.hostname || "").toLowerCase();
    return h === CLOUD_HOST || h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "";
  } catch(e){ return true; }
}
function cloudProfileNow(){
  return { name: g_profile.name || "", skin: g_profile.skin|0,
           cleared: [0,1,2,3].map(i=>!!(g_profile.cleared||[])[i]),
           spared:  [0,1,2,3].map(i=>!!(g_profile.spared||[])[i]) };
}
function cloudRoom(){
  try {
    if (typeof g_roomFurn !== "undefined" && Array.isArray(g_roomFurn))
      return g_roomFurn.map(f=>({ kind:f.kind, gx:f.gx|0, gy:f.gy|0, rot:f.rot?1:0, on:f.on?1:0, sw:f.sw?1:0 }));
  } catch(e){}
  return localRoom();
}
function localRoom(){
  try { const a = JSON.parse(localStorage.getItem("sanjiao_room_v1") || "[]"); return Array.isArray(a)?a:[]; } catch(e){ return []; }
}
function cloudSnapshot(){
  return { v:1, prof: cloudProfileNow(), room: cloudRoom(), at: Date.now() };
}
async function cloudPushNow(){               // 上传当前存档（幂等：一个账号一行）
  const c = cloudClient();
  if (!c || !g_cloud.uid) return false;
  g_cloud.pushAt = Date.now();
  try {
    const { data, error } = await c.database.from(CLOUD_TABLE)
      .upsert({ data: cloudSnapshot(), owner_name: (g_profile.name || null),
                updated_at: new Date().toISOString() }, { onConflict: "owner_id" })
      .select("id");
    if (error){ g_cloud.lastErr = cloudErrText(error, "存档上传失败"); return false; }
    g_cloud.dirty = false; g_cloud.lastErr = "";
    return Array.isArray(data);
  } catch(e){ g_cloud.lastErr = cloudErrText(e, "存档上传失败"); return false; }
}
function cloudPushSoon(delay){                // 存档一变就排队上传，1.2 秒内的多次改动合并成一次
  if (!g_cloud.uid) return;
  g_cloud.dirty = true;
  if (g_cloud.pushT) return;
  g_cloud.pushT = setTimeout(()=>{
    g_cloud.pushT = 0;
    if (g_cloud.dirty) cloudPushNow();
  }, delay || 1200);
}
async function cloudPull(){                   // 取回云端存档（没有就返回 null）
  const c = cloudClient();
  if (!c || !g_cloud.uid) return null;
  try {
    const { data, error } = await c.database.from(CLOUD_TABLE).select("data").maybeSingle();
    if (error){
      if (error.code !== "PGRST116") g_cloud.lastErr = cloudErrText(error, "存档下载失败");
      return null;
    }
    return (data && data.data) || null;
  } catch(e){ g_cloud.lastErr = cloudErrText(e, "存档下载失败"); return null; }
}
function cloudKey(){ return "u:" + (g_cloud.uid || "me"); }
function cloudApply(data){                    // 云端存档 → 本机缓存 → 当前档案
  const key = cloudKey();
  const accounts = loadAccounts();
  const old = accounts[key];
  const prof = (data && data.prof) || null;
  if (!prof && !old) return false;
  const src = prof || old;
  const name = String(src.name||"").replace(/\s+/g," ").trim().slice(0,12);
  const skin = src.skin|0;
  const cl = Array.isArray(src.cleared) ? src.cleared : [];
  const sp = Array.isArray(src.spared)  ? src.spared  : [];
  accounts[key] = { name, skin: (skin>=0 && skin<CHARS.length) ? skin : 0, pwd:"",
                    cleared: [0,1,2,3].map(i=>!!cl[i]), spared: [0,1,2,3].map(i=>!!sp[i]) };
  saveAccounts(accounts);
  if (data && Array.isArray(data.room)){       // 家具跟着账号一起搬
    try { localStorage.setItem("sanjiao_room_v1", JSON.stringify(data.room)); } catch(e){}
    try { if (typeof loadRoom === "function") loadRoom(); } catch(e){}
  }
  applyAccount(key);
  return true;
}
function pickLocalSave(){                     // 云端还没存档时，把本机这份带上去（老玩家不丢进度）
  const accounts = loadAccounts();
  const keys = [g_accountKey, currentUserName()].filter(Boolean);
  for (const k of keys){
    const a = accounts[k];
    if (a && a.name) return { name:a.name, skin:a.skin|0, cleared:a.cleared||[], spared:a.spared||[] };
  }
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (p && p.name) return { name:p.name, skin:p.skin|0, cleared:p.cleared||[], spared:p.spared||[] };
  } catch(e){}
  return null;
}
function cloudUidOf(user){
  return (user && (user.id || user.uid || user.userId)) || g_cloud.uid || "me";
}
async function cloudEnter(user){              // 登录/注册成功 → 取云端存档 → 进标题
  try { localStorage.removeItem(LOGOUT_KEY); } catch(e){}
  g_cloud.uid = cloudUidOf(user);
  g_cloud.email = (user && user.email) || (g_login.user||g_su.email||"").trim().toLowerCase();
  g_login.ok = "正在取回云端存档…";
  const data = await cloudPull();
  g_login.ok = "";
  if (data && data.prof){
    cloudApply(data);
    hideInput(); playSfx("snd_menu_select"); Say(""); GoTitle();
    setToast("云端存档已就位", "#8ff0b8");
    return true;
  }
  const local = pickLocalSave();
  if (local){
    cloudApply({ v:1, prof: local, room: localRoom() });
    cloudPushSoon(200);
    hideInput(); playSfx("snd_menu_select"); Say(""); GoTitle();
    setToast("已把本机存档上传到这个账号", "#8ff0b8");
    return true;
  }
  hideInput(); Say("");
  openCreate(true);                           // 全新账号：起名 + 选外貌，完成后自动上传
  return true;
}
async function cloudLogin(){                  // 邮箱 + 密码 → 云端会话
  if (g_cloud.busy) return;
  const email = (g_login.user||"").trim().toLowerCase();
  const pwd = g_login.pwd || "";
  if (!cloudEmailOk(email)){ g_login.err = "账号就是邮箱，格式不对"; g_login.pwd=""; g_inputMode=""; return; }
  if (pwd.length < 6){ g_login.err = "密码至少 6 位"; return; }
  const c = cloudClient();
  if (!c){ g_login.err = "云账号组件还在加载，等两秒再点一次"; return; }
  g_cloud.busy = true; g_login.err = ""; g_login.ok = "正在登录…";
  playSfx("snd_menu_select");
  let r;
  try { r = await c.auth.signInWithPassword({ email, password: pwd }); }
  catch(e){ r = { error:e }; }
  g_cloud.busy = false; g_login.ok = "";
  if (!r || r.error || !r.data){
    g_login.err = cloudErrText(r && r.error, "登录失败");
    g_login.pwd = ""; g_inputMode = "";
    playSfx("snd_menu_move");
    return;
  }
  await cloudEnter(r.data.user || {});
}
async function cloudLogout(){
  const c = cloudClient();
  g_cloud.busy = true;
  try { if (c) await c.auth.signOut(); } catch(e){}
  g_cloud.busy = false;
  g_cloud.uid = ""; g_cloud.email = "";
  try { localStorage.setItem(LOGOUT_KEY, "1"); } catch(e){}   // 下次打开先停在登录页
  g_login.ok = "已退出账号（本机存档还在）";
  playSfx("snd_menu_move");
}
async function cloudRestore(){                // 启动时静默恢复会话
  const c = cloudClient();
  if (!c) return false;
  let s = null;
  try { const r = await c.auth.getSession(); s = r && r.data; } catch(e){ return false; }
  if (!s || !s.user) return false;
  g_cloud.uid = cloudUidOf(s.user);
  g_cloud.email = s.user.email || "";
  const data = await cloudPull();
  if (data && data.prof) cloudApply(data);
  return true;
}

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
  skSeen:"",                                               // 技能附加效果去重键
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
  net.name = (loadProfile() && g_profile.name)
    ? g_profile.name                                  // 存档里的名字：组队邀请就显示这个
    : (localStorage.getItem("sj_name") ||
       ("玩家-"+Math.random().toString(36).slice(2,5).toUpperCase()));
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
  if (typeof mqtt==="undefined"){                  // 联机库还没到（CDN 慢 / 被拦）→ 过一会儿再试
    net.libTries = (net.libTries||0) + 1;
    net.libOk = net.libTries>12 ? false : null;
    if (net.libTries<=12) setTimeout(netConnect, 1500);
    return;
  }
  net.libOk = true; net.libTries = 0;
  if (net.cli){ try { net.cli.end(true); } catch(e){} net.cli = null; }
  const url = NET_URLS[0];
  try {
    net.cli = mqtt.connect(url, {
      clientId:"sjc_"+net.cid+"_"+Math.random().toString(36).slice(2,6),
      clean:true, keepalive:30, reconnectPeriod:4000, connectTimeout:8000 });
    net.cli.on("connect", ()=>{
      net.on=true; net.retryAt=0; net.fails=0;
      net.cli.subscribe([NET_BASE+"/p/#", NET_BASE+"/i/"+net.cid, NET_BASE+"/t/"+net.cid], ()=>{});
    });
    net.cli.on("close", ()=>{ net.on=false; net.fails=(net.fails||0)+1; });
    net.cli.on("error", ()=>{ net.fails=(net.fails||0)+1; netRetryConnect(); });
    net.cli.on("message", (topic, payload)=>{
      let m; try { m=JSON.parse(payload.toString()); } catch(e){ return; }
      netMsg(topic, m);
    });
    setTimeout(()=>{ if (!net.on) netRetryConnect(); }, 9000);
  } catch(e){ net.on=false; netRetryConnect(); }
}
function netRetryConnect(force){                     // 连不上就重连同一个 broker（换 broker 会导致两端互相看不见）
  if (net.on) return;
  const now=Date.now();
  if (!force && net.retryAt && now-net.retryAt<8000) return;   // 别堆定时器
  net.retryAt=now;
  try { net.cli && net.cli.end(true); } catch(e){}
  net.on=false;
  setTimeout(()=>{ net.retryAt=0; if (!net.on) netConnect(); }, force?200:2500);
}
// 右下角那行状态：以前离线时整块都不画，CDN 没加载 / 连不上 broker 的电脑就什么都看不到
function netStatusText(){
  if (net.on) return "● 在线 " + netOnline();
  if (typeof mqtt==="undefined") return "○ 联机组件没加载";
  if ((net.fails||0) >= 2) return "○ 联机连不上";
  return "○ 连接中…";
}
function netUserRetry(){                             // 点右下角状态：手动重连
  net.fails = 0; net.libTries = 0; net.libOk = null;
  if (typeof mqtt==="undefined"){
    Say("联机组件还没加载出来（被网络拦了），稍后自动再试");
    netConnect();
    return;
  }
  netRetryConnect(true);
  Say(net.on ? "联机正常" : "正在重连联机服务…");
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
      if (m.k!==undefined) net.pSkin=m.k|0;
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
    } else if (m.t==="acc"){ netTeamForm(m.from, m.n, m.k); }
    else if (m.t==="rej"){ if (net.invSent===m.from){ net.invSent=0; Say(m.n+" 拒绝了组队邀请"); } }
    else if (m.t==="busy"){ if (net.invSent===m.from){ net.invSent=0; Say(m.n+" 正在组队中"); } }
    else if (m.t==="ok"){                                // 队长确认 → 我是队员
      if (net.leftAt && Date.now()-net.leftAt<6000) return;  // 刚退出，忽略迟到的确认
      if (net.role==="member" && net.partner===m.leader) return;   // QoS 重发的重复包：别覆盖当前字幕/状态
      net.role="member"; net.partner=m.leader; net.partnerName=m.n;
      net.pSkin=(m.k!==undefined)?(m.k|0):net.pSkin; net.lostSince=0; net.leftAt=0;
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
function netTeamForm(cid, name, skin){
  if (net.role || (net.invSent && net.invSent!==cid)) return;
  net.role="leader"; net.partner=cid; net.partnerName=name;
  net.pSkin=(skin!==undefined)?(skin|0):net.pSkin; net.lostSince=0; net.leftAt=0;
  net.teamTopic=NET_BASE+"/t/"+net.cid;
  net.invSent=0; net.panel=false; net.pTs=0; net.bTs=0;
  net.cli.subscribe(net.teamTopic, ()=>{});
  netPubRetry(NET_BASE+"/i/"+cid, {t:"ok", leader:net.cid, n:net.name, k:g_profile.skin}, 3);
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
    if (m.mh) net.pmh=m.mh;                                 // 队友的血量上限（Ralsei 150 / 其它 120）
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
    if (m.kind==="fight" || m.kind==="skill") startPAttack(1, (m.dmg|0)>0?"fight":"miss");  // 队友的出刀动作也要看得见
    if (isLeader() && (m.kind==="fight" || m.kind==="skill") && m.dmg>0) HitJevil(m.dmg|0);   // 队长权威扣血（技能也一样）
    net.pAct=true;
    // 已经出过刀在等队友 → 开打；已经阵亡（观战）且停在菜单里 → 也要继续推进，
    // 否则死掉的那一方会永远卡在菜单，队长不发 atk，活着的人只能干等
    if (net.myAct && (g_state===ST_WAIT || (g_dead && g_state===ST_MENU))) netBothActed();
  } else if (m.t==="sk"){                               // 队友放了角色技能 → 附加效果对我也生效
    if (m.from && m.from===net.cid) return;
    if (m.turn!==undefined && m.turn!==g_turn) return;
    const skey="k"+m.from+":"+m.turn+":"+m.k;
    if (net.skSeen===skey) return;                      // 重发包只算一次
    net.skSeen=skey;
    if (m.k==="sword"){
      g_buff.weaken=0.5;
      setToast("队友的胜利之剑 —— 本回合受到的伤害 -50%", "#ff9ab8");
      AddRing(JEV_CX, JEV_CY, 110, 255, 150, 200);
    } else if (m.k==="potion"){
      g_buff.regen=Math.max(g_buff.regen,3);
      g_buff.chill=true;
      setToast("队友的神奇药水 —— 接下来 3 回合每回合 +30 HP", "#8fe6a0");
      AddRing(g_heartX, g_heartY, 70, 120, 255, 160);
    }
  } else if (m.t==="gtr"){                               // 队友弹了电吉他 → 队长这边放宽本回合弹幕
    if (m.turn===undefined || m.turn===g_turn){
      const gk="g"+m.from+":"+m.turn+":"+m.n;            // 重发包只算一次
      if (net.gtrSeen!==gk){ net.gtrSeen=gk; g_buff.guitar=Math.min(2, g_buff.guitar+1); }
    }
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
    if (m.s===ST_WIN||m.s===ST_LOSE||m.s===ST_SPARE){
      if (m.s===ST_WIN){ AwardDrop(g_boss); g_state=ST_WIN; }       // 队友看到的胜利也算通关掉落
      else if (m.s===ST_SPARE){ MarkSpared(g_boss); g_lastDrop=""; g_state=ST_SPARE; }
      else g_state=m.s;
      g_stateT=0; Say(m.txt||"");
    } else if (m.s===ST_MENU){
      // 我正在结算自己的行动（出刀条/伤害/对话/等队友）时不能被队长的菜单重发打断
      if (g_state===ST_FIGHT||g_state===ST_DMG||g_state===ST_DIALOG||
          g_state===ST_SUB||g_state===ST_WAIT) return;
      if (g_state===ST_ATTACK) g_turn++;                 // 回合号跟队长对齐
      clearTurnBuffs();
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
    if (m.h){ netPartnerHeart(m.h[0], m.h[1], m.h[3]); net.php=m.h[2]; if (m.h[4]) net.pmh=m.h[4]; }
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
  net.role=""; net.partner=""; net.partnerName=""; net.pSkin=undefined; net.teamTopic="";
  net.px=undefined; net.php=undefined; net.pmh=undefined; net.lostSince=0; net.pseen=0; net.pS="";
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
  netPub(NET_BASE+"/i/"+cid, {t:"inv", from:net.cid, n:net.name, k:g_profile.skin});
  Say("已向 "+(net.players.get(cid)?.n||"对方")+" 发出组队邀请…");
}
function netAcceptInvite(){
  const iv=net.invite; if (!iv) return;
  net.invite=null;
  netPub(NET_BASE+"/i/"+iv.from, {t:"acc", from:net.cid, n:net.name, k:g_profile.skin});
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
  netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s:"lobby", ts:Date.now(), i:net.inst, k:g_profile.skin});
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
    netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s, ts:nowMs, i:net.inst, k:g_profile.skin});
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
      hp:Math.round(g_hp), mh:Math.round(maxHp()), d:g_dead?1:0};
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
        if (g_state===ST_WIN||g_state===ST_LOSE||g_state===ST_SPARE||g_state===ST_MENU)
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
for (const c of CHARS){ IMG_LIST.push(c.img); IMG_LIST.push(c.atk); IMG_LIST.push("walk_"+c.key); IMG_LIST.push("idle_"+c.key); }
for (const f of FURN) IMG_LIST.push(f.img);          // 家具像素素材   // 待机 + 挥刀 + 原版 overworld 站立/走路

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
let bgmName = "", bgmWant = "";             // bgmWant：想放的曲子（被浏览器拦了自动播放时留着，一有操作就补放）
function BgmStart(file){
  const src = ASSET(file);
  if (bgmName === src && !bgm.paused) return;
  bgmName = src; bgmWant = src; bgm.src = src; bgm.volume = g_vol/100;
  bgm.play().catch(()=>{});                   // 手机/Safari 没操作过会被拒，交给 TryResumeBgm
}
function BgmStop(){ bgm.pause(); bgmName=""; bgmWant=""; }
function TryResumeBgm(){                      // 任意按键/点击后补放（浏览器要求先有用户操作）
  if (!bgmWant) return;
  if (bgm.paused){ bgm.play().catch(()=>{}); }
  else if (bgmName !== bgmWant){ BgmStart(bgmWant); }
}

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

// ---------------- 道具逻辑 ----------------
function hasGear(k){
  const it = ItemByKey(k);
  return !!(it && g_profile.cleared && g_profile.cleared[it.boss]);
}
function gearLeft(k){
  const it = ItemByKey(k);
  return it ? Math.max(0, it.max - (g_gearUse[k]||0)) : 0;
}
function ownedGear(){ return ITEMS.filter(i=>hasGear(i.key)); }
// 音波干扰：一层让弹幕密度减半（发射间隔 ×2、弹速同步变慢）；叠满两层直接静音本回合
function gearRate(){ return g_buff.guitar>0 ? Math.pow(0.5, Math.min(2,g_buff.guitar)) : 1; }
function gearMuted(){ return g_buff.guitar>=2; }
function clearTurnBuffs(){                 // 一个对手回合结束 → 回合制增益全清，吉他次数回满
  g_buff.tv=false; g_buff.fuse=false; g_buff.guitar=0;
  g_buff.weaken=0; g_buff.chill=false;     // 减攻/降难度只持续本回合
  g_gearUse.guitar=0;
  tickRegen();                             // 神奇药水：回合结束后结算一次回血
}
function tickRegen(){                      // 药水剩余回合数 -1，并回复 30 HP（阵亡不生效）
  if (!g_buff.regen) return;
  g_buff.regen--;
  if (g_dead) return;
  const before=g_hp;
  g_hp=Math.min(maxHp(), g_hp+30);
  const got=Math.round(g_hp-before);
  if (got>0){
    AddRing(g_heartX, g_heartY, 52, 120, 255, 160);
    for (let i=0;i<7;++i)
      g_sparks.push({x:g_heartX+rnd(-14,14), y:g_heartY+rnd(-14,14), t:0, scale:rnd(0.6,1.1)});
    g_dmg.push({x:g_heartX, y:g_heartY-24, vy:-42, life:0.9, val:got, miss:false, heal:true});
  }
}
function setToast(txt, col){ g_toast={txt, t:2.2, col:col||"#ffe878"}; }
function AwardDrop(boss){                  // 只有打赢才算通关：存档记下并把道具掉出来
  const it = ITEMS[boss]; if (!it) return;
  if (!Array.isArray(g_profile.cleared)) g_profile.cleared=[false,false,false,false];
  g_profile.cleared[boss]=true;
  g_lastDrop=it.key;
  saveProfile();
}
function MarkSpared(boss){                 // 饶恕：不算通关、不掉道具，只在卡牌下标「饶恕」
  if (!Array.isArray(g_profile.spared)) g_profile.spared=[false,false,false,false];
  if (g_profile.spared[boss]) return;
  g_profile.spared[boss]=true;
  g_lastDrop="";
  saveProfile();
}
function itemList(){                       // ITEM 子菜单：软糖 + 已拥有的道具
  const list=[{kind:"candy"}];
  for (const g of ownedGear()) list.push({kind:"gear", key:g.key});
  return list;
}
function itemLabel(it){
  if (it.kind==="candy") return `魔法软糖 ×${g_items}`;
  const g=ItemByKey(it.key);
  return `${g.name} ${gearLeft(g.key)}/${g.max}`;
}
function itemHint(it){
  if (it.kind==="candy") return g_items>0 ? "回复 60 HP" : "已经吃光了";
  return ItemByKey(it.key).desc;
}

// ---------------- 流程 ----------------
function Say(s){ g_subtitle = s; }

function ResetGame(){
  const B = Boss();
  g_hp=maxHp(); g_items=3; g_pacify=0; g_turn=0;
  g_gearUse={scythe:0,tv:0,fuse:0,guitar:0};        // 新一场：道具次数回满
  g_skillUse=0;                                     // 新一场：专属技能每局一次，重新可用
  g_buff={scythe:false,tv:false,fuse:false,guitar:0,weaken:0,regen:0,chill:false};
  g_lastDrop=""; g_toast=null;
  g_jevHp=B.maxhp; g_jevHpShown=false; g_spareReady=false;
  g_state=ST_INTRO; g_stateT=0; g_sub=SM_NONE; g_btnSel=0;
  g_bullets=[]; g_dmg=[]; g_sparks=[];
  g_heartX=BOX_CX; g_heartY=BOX_CY; g_inv=0;
  g_jevOffX=0; g_jevOffY=0; g_tpTimer=0;
  PATK[0]=null; PATK[1]=null;
  layoutFighters();
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
function GoRoom(){
  g_state=ST_ROOM; g_stateT=0;
  loadRoom(); g_hold=null;                        // 读回上次摆的家具
  g_room.x=WINW/2; g_room.y=clamp(Math.round(WINH*0.78), roomFloorTop(), roomFloorBot());
  g_room.face=1; g_room.t=0; g_room.moving=false;
  let guard=0;                                    // 出生点正好被家具占了：往上让开
  while (roomBlocked(g_room.x, g_room.y) && g_room.y>roomFloorTop() && guard++<300) g_room.y-=8;
  g_bullets=[]; g_dmg=[]; g_sparks=[]; Say("");
  BgmStop(); BgmStart("bgm_verdanturf.mp3");          // 房间 BGM：宝可梦绿宝石 绿茵市（ASSET 会自动补 assets/ 前缀）
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
  const ramp = (g_buff.chill ? 1.0 : 1.0 + Math.min(1.0, g_turn*0.10)) * gearRate();
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
  // 电视机：本回合每次受击都有 30% 概率被信号吃掉（免伤）
  if (g_buff.tv && rnd(0,1) < 0.30){
    g_inv=0.55;
    AddRing(g_heartX, g_heartY, 46, 130, 225, 255);
    for (let i=0;i<7;++i)
      g_sparks.push({x:g_heartX+rnd(-12,12), y:g_heartY+rnd(-12,12), t:0, scale:rnd(0.5,0.95)});
    g_dmg.push({x:g_heartX, y:g_heartY-16, vy:-46, life:0.75, val:0, miss:true});
    playSfx("snd_menu_move");
    return;
  }
  if (g_buff.fuse) dmg = Math.max(1, Math.round(dmg*0.7));    // 引线：本回合受到的伤害 -30%
  if (g_buff.weaken>0) dmg = Math.max(1, Math.round(dmg*g_buff.weaken));  // 胜利之剑：本回合敌方伤害减半
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
    WinBattle(`${Boss().name} 倒下了……`);
  }
}
function WinBattle(txt){                       // 打赢：记通关 + 掉道具
  if (g_state!==ST_WIN) AwardDrop(g_boss);
  g_state=ST_WIN; g_stateT=0;
  Say(txt||"");
}
function SpareBattle(txt){                     // 饶恕：不走胜利、不掉道具，只盖章「饶恕」
  if (g_state!==ST_WIN && g_state!==ST_SPARE) MarkSpared(g_boss);
  g_lastDrop="";
  g_state=ST_SPARE; g_stateT=0;
  Say(txt||"");
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
// 使用掉落道具。返回：
//  "fight" = 已转入出刀时机条 / "action" = 已开始对话（耗掉本回合行动）
//  "free"  = 不消耗行动（电吉他）/ "fail" = 用不了
function UseGear(key, after){
  const g = ItemByKey(key);
  if (!g || !hasGear(key)) return "fail";
  if (gearLeft(key) <= 0){
    setToast(g.per==="turn" ? `${g.name}：本回合的次数用完了` : `${g.name}：本局已经用过了`, "#ff9a9a");
    return "fail";
  }
  g_gearUse[key]++;
  if (key==="scythe"){
    g_buff.scythe=true;
    setToast("恶魔镰刀出鞘 —— 这一刀伤害翻倍！", "#d9a6ff");
    AddRing(JEV_CX, JEV_CY, 90, 200, 140, 255);
    playSfx("snd_menu_select");
    g_btnSel=0; g_state=ST_FIGHT; g_stateT=0; g_barX=250; g_barHit=false;
    return "fight";
  }
  if (key==="tv"){
    g_buff.tv=true;
    StartDialog("电视机亮起雪花 —— 这回合每次受击都有 30% 概率被信号吃掉！", after);
  } else if (key==="fuse"){
    g_buff.fuse=true;
    StartDialog("引线嘶嘶作响 —— 这回合受到的伤害降低 30%！", after);
  } else if (key==="guitar"){
    g_buff.guitar=Math.min(2, g_buff.guitar+1);
    const gt = g_buff.guitar>=2 ? "音波干扰拉满 —— 本回合弹幕全部静音！"
                               : "音波干扰 —— 本回合弹幕频率 -50%（再弹一次可静音）";
    setToast(gt+"（不消耗行动）", "#ff9ad4");
    AddRing(JEV_CX, JEV_CY, 70, 255, 140, 220);
    playSfx("snd_menu_select");
    if (isMember()) netRtcSend({t:"gtr", from:net.cid, turn:g_turn, n:g_gearUse.guitar}, 1, 2);   // 让队长放宽本回合弹幕
    return "free";
  }
  g_actionKind="item"; g_actionDmg=0;
  return "action";
}
// 使用角色专属技能（消耗本回合行动）。after = 行动结束后的去向（联机要先等队友）
function useSkill(after){
  const sk = mySkill();
  if (!sk) return;
  if (skillLeft()<=0){                            // 已经用掉：仍然算一次行动（白费一回合）
    setToast(`${sk.name}：本局已经用过了，白白浪费一回合`, "#ff9a9a");
    g_actionKind="skill"; g_actionDmg=0;
    StartDialog(`${sk.name} 本局已经用过了……这一回合白白浪费掉了。`, after);
    return;
  }
  g_skillUse++;
  playSfx("snd_menu_select");
  const sd = skillDmg(sk);                        // 角色被动（Susie：伤害 +10%）
  if (sk.dmg>0){                                  // 有伤害的：原地挥一刀
    startPAttack(0, "fight");
    DoAttack(sd);
    AddShake(0.2, 4);
  }
  if (sk.key==="sword"){
    g_buff.weaken = 0.5;                          // 本回合敌方造成的伤害 -50%
    AddRing(JEV_CX, JEV_CY, 130, 255, 150, 200);
  } else if (sk.key==="potion"){
    g_buff.regen = Math.max(g_buff.regen, 3);     // 接下来 3 个回合结束各回 30
    g_buff.chill = true;                          // 本回合难度回到「满血/开局」水平
    AddRing(g_heartX, g_heartY, 78, 120, 255, 160);
  }
  // 联机：除粗暴砍击外，附加效果对队友也生效
  if (sk.key!=="chop" && net.role)
    netRtcSend({t:"sk", from:net.cid, turn:g_turn, k:sk.key}, 1, 2);
  g_actionKind="skill"; g_actionDmg=sd;
  if (g_state===ST_WIN || g_state===ST_SPARE || g_jevHp<=0) return;    // 已经结算：别再盖掉结算画面
  StartDialog(skillLine(sk, sd), after);
}
function DoPlayerAction(){
  const B = Boss();
  // 行动结束的去向：一律走 AfterAction（单人=对手台词→弹幕回合；联机=先跟队友对表）
  // 技能/ACT/道具都算消耗一回合，不再回到指令菜单
  const after = ST_WAIT;
  if (g_sub===SM_ACT){
    if (g_subSel===0){ useSkill(after); g_sub=SM_NONE; return; }   // 用过也要消耗一回合
    if (g_subSel===1){ StartDialog(B.check, after); }
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
    const list=itemList();
    const it=list[clamp(g_subSel,0,list.length-1)];
    if (!it){ g_state=ST_MENU; g_sub=SM_NONE; return; }
    if (it.kind==="candy"){
      if (g_items>0){
        g_items--; g_hp=Math.min(maxHp(), g_hp+60);
        g_dmg.push({x:JEV_CX, y:JEV_CY-60, vy:-40, life:0.8, val:60, miss:false});
        StartDialog("你吃掉了魔法软糖，回复了 60 HP！", after);
      } else StartDialog("软糖吃光了……", after);
      g_actionKind="item"; g_actionDmg=0;
    } else {
      const r = UseGear(it.key, after);
      g_sub=SM_NONE;
      if (r==="free"){ g_sub=SM_ITEM; return; }      // 吉他不消耗行动：留在道具页可再点一次
      if (r==="fail"){ g_state=ST_MENU; g_subSel=0; } // 用完/没拥有：退回指令行
      return;
    }
  } else if (g_sub===SM_MERCY){
    if (g_subSel===0){
      if (g_spareReady){
        for (let i=0;i<10;++i)
          g_sparks.push({x:JEV_CX+rnd(-80,80), y:JEV_CY+rnd(-90,90), t:0, scale:rnd(1.0,2.0)});
        AddRing(JEV_CX, JEV_CY, 110, 160, 255, 210);
        SpareBattle(`你放过了${B.name}……它安心地睡着了。`);
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
  if (g_toast){ g_toast.t-=dt; if (g_toast.t<=0) g_toast=null; }
  updatePAttack(dt);
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
  case ST_ROOM: {                     // 我的房间：方向键 / WASD / 屏幕方向键都能走
    g_stateT+=dt;
    let dx=0, dy=0;
    if (keys.has("ArrowLeft")||keys.has("a")||keys.has("A"))  dx-=1;
    if (keys.has("ArrowRight")||keys.has("d")||keys.has("D")) dx+=1;
    if (keys.has("ArrowUp")||keys.has("w")||keys.has("W"))    dy-=1;
    if (keys.has("ArrowDown")||keys.has("s")||keys.has("S"))  dy+=1;
    if (dx||dy){
      const len=Math.hypot(dx,dy)||1;
      const vx=dx/len*ROOM_SPD*dt, vy=dy/len*ROOM_SPD*dt*0.72;
      const nx=clamp(g_room.x+vx, 26, WINW-26);
      const ny=clamp(g_room.y+vy, roomFloorTop(), roomFloorBot());
      if (!roomBlocked(nx, g_room.y)) g_room.x=nx;   // 分轴判定：贴着家具也能顺着边滑
      if (!roomBlocked(g_room.x, ny)) g_room.y=ny;
      if (dx) g_room.face = dx>0?1:-1;
      g_room.moving=true; g_room.t += dt;
    } else {
      g_room.moving=false; g_room.t = 0;        // 站住就回到第 0 帧（原版站立姿势）
    }
    g_room.x=clamp(g_room.x, 26, WINW-26);
    g_room.y=clamp(g_room.y, roomFloorTop(), roomFloorBot());
    break;
  }
  case ST_PAUSE:
    break;                       // 完全冻结（与 C++ 版一致：暂停不推进计时）
  case ST_ATTACK: {
    const B = Boss();
    g_stateT+=dt;
    // 神奇药水：本回合难度回到「满血/开局」水平（不吃回合数递增）
    const ramp = (g_buff.chill ? 1.0 : 1.0+Math.min(1.0,g_turn*0.10))*B.patW*gearRate();   // 音波干扰：ramp 越小 → 弹幕越稀

    // 红心移动（键盘方向键 / 屏幕方向键都写进同一个 keys）
    let sp = heartSpd()*dt;
    if (!g_dead){
      if (keys.has("ArrowLeft"))  g_heartX-=sp;
      if (keys.has("ArrowRight")) g_heartX+=sp;
      if (keys.has("ArrowUp"))    g_heartY-=sp;
      if (keys.has("ArrowDown"))  g_heartY+=sp;
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
    const firing = g_stateT>=B.warn && !isMember() && !gearMuted();
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
            g_hp=Math.min(maxHp(), g_hp+12);
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
          g_hp=Math.min(maxHp(), g_hp+12);
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
      clearTurnBuffs();                         // 对手回合结束：本回合增益失效
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
let touchStart = null;         // 点按判定（只给热区用）

// 每帧渲染时重建的点击热区
let hotspots = [];
function hot(x,y,w,h,fn){ hotspots.push({x,y,w,h,fn}); }

// ---- 触屏常驻按键：上 / 左 / 右 / 下 + A(确定) / B(返回) ----
let SAFE_B = 0;                                  // 底部安全区（手机手势条）
let VSC = 1;                                     // 1 CSS 像素 = 多少舞台逻辑像素（fitCanvas 里算）
const AVATAR = { on:false, x:0, y:0, w:0, h:0 };  // 右上角常驻角色头像
const PAD = { on:false, k:46, up:null, down:null, left:null, right:null, a:null, b:null };
const VDIR = { up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight" };
const vptr = new Map();                          // pointerId → 按键 id（多指各管各的）

function vpadLayout(){                           // 屏幕尺寸/安全区变了就重排
  PAD.on = !!isTouch;
  if (!PAD.on) return;
  // 尺寸按 CSS 像素定：舞台逻辑分辨率会随屏幕比例变大（横屏 844×390 时逻辑宽 1039），
  // 若按逻辑像素算，按键实测只有 37 CSS px，拇指根本压不准。
  const ww = document.documentElement.clientWidth  || WINW;
  const wh = document.documentElement.clientHeight || WINH;
  const kCss = clamp(Math.min(ww, wh) * 0.150, 54, 82);   // 单键边长（CSS px）
  const k = kCss * VSC;
  const g = 3 * VSC;                               // 键间缝隙：贴着摆会连按误触
  const m = 8 * VSC;                               // 距屏幕边缘留白
  PAD.k = k;
  // 竖屏底部有 FIGHT/ACT/ITEM/MERCY 指令行：整组按键上抬让开，免得压住指令按钮
  const lift = (wh > ww) ? 56*VSC : 0;
  const bot = WINH - SAFE_B - lift;
  const md = 5*VSC;                                // 方向键贴边一些，让开标题卡片/tips
  const x0 = md, y0 = bot - m - (3*k + 2*g);
  PAD.up    = {x:x0+k+g,     y:y0,         w:k, h:k};
  PAD.left  = {x:x0,         y:y0+k+g,     w:k, h:k};
  PAD.right = {x:x0+2*(k+g), y:y0+k+g,     w:k, h:k};
  PAD.down  = {x:x0+k+g,     y:y0+2*(k+g), w:k, h:k};
  const ra = k*0.66, rb = k*0.56;                  // A 稍大、B 稍小，但都是拇指级
  const ma = 12*VSC;                               // 圆键离边留多点，避开手势条
  const ax = WINW - ma - ra, ay = bot - ma - ra;   // A：右下角
  PAD.a = {x:ax, y:ay, r:ra};
  PAD.b = {x:ax - ra - rb - 12*VSC, y:ay - rb*0.38, r:rb};   // B：A 正左侧略高，同一排好按
}
function vpadHitDir(x,y){                        // 只判方向键（滑动换向用）
  if (!PAD.on) return null;
  const pad = Math.max(4, PAD.k*0.08);
  for (const id of ["up","down","left","right"]){
    const q=PAD[id];
    if (x>=q.x-pad && x<=q.x+q.w+pad && y>=q.y-pad && y<=q.y+q.h+pad) return id;
  }
  return null;
}
function vpadHit(x,y){                           // 命中的按键 id
  if (!PAD.on) return null;
  const dir = vpadHitDir(x,y);
  if (dir) return dir;
  const pad = Math.max(4, PAD.k*0.08);           // 命中范围略放大，手指压边也算
  for (const id of ["a","b"]){
    const q=PAD[id];
    if ((x-q.x)*(x-q.x)+(y-q.y)*(y-q.y) <= (q.r+pad)*(q.r+pad)) return id;
  }
  return null;
}
function pressBack(){                            // B：返回 / 取消
  if (g_state===ST_ROOM){ pressKey("x"); return; }
  if (g_state===ST_CREATE || g_state===ST_LOGIN || g_state===ST_SETPWD || g_state===ST_SYNC || g_state===ST_SIGNUP){ pressKey("x"); return; }
  if (g_pauseUI){ closePause(); playSfx("snd_menu_move"); return; }
  if (g_state===ST_PAUSE){ g_state=g_pauseFrom; playSfx("snd_menu_move"); return; }
  if (net.invite){ netDeclineInvite(); return; }
  if (g_state===ST_SUB){ pressKey("x"); return; }
}

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
  // ---- 登录（云端账号：邮箱 + 密码）
  if (g_state===ST_LOGIN){
    if (vk==="ArrowUp" || vk==="ArrowDown" || vk==="Tab"){
      g_login.sel = 1 - g_login.sel; g_login.err = "";
      if (g_login.sel===0) setInputMode("loginUser", g_login.user, 64, true);
      else                 setInputMode("loginPwd",  g_login.pwd,  32, true);
      focusInput();
      playSfx("snd_menu_move");
    }
    if (vk==="z"||vk==="Enter") doLogin();
    if (vk==="x"||vk==="Escape"||vk==="b"){
      if (g_accountKey || g_cloud.uid){ hideInput(); playSfx("snd_menu_move"); GoTitle(); }
      else g_login.err = "先登录或注册一个账号";
    }
    return;
  }
  // ---- 注册 / 重设密码
  if (g_state===ST_SIGNUP){
    if (vk==="Tab" || vk==="ArrowUp" || vk==="ArrowDown"){
      const d = (vk==="ArrowDown" || vk==="Tab") ? 1 : -1;
      g_su.sel = (g_su.sel + d + 3) % 3; g_su.err = "";
      if (g_su.sel===0)      setInputMode("suEmail", g_su.email, 64, true);
      else if (g_su.sel===1) setInputMode("suCode",  g_su.code,  8,  true);
      else                   setInputMode("suPwd",   g_su.pwd,   32, true);
      focusInput();
      playSfx("snd_menu_move");
    }
    if (vk==="z"||vk==="Enter") suSubmit();
    if (vk==="s"||vk==="S") suSendCode();                       // S = 发验证码
    if (vk==="x"||vk==="Escape"||vk==="b"){
      hideInput(); playSfx("snd_menu_move"); openLogin(g_su.email, false);
    }
    return;
  }
  // ---- 存档搬运（导出 / 导入）
  if (g_state===ST_SYNC){
    if (vk==="Tab"){ g_sync.tab = 1-g_sync.tab; g_sync.err=""; g_sync.over=""; g_sync.ok="";
      playSfx("snd_menu_move");
      if (g_sync.tab===1 && !isTouch) focusInput(); else hideInput();
      return;
    }
    if (vk==="ArrowLeft" || vk==="ArrowRight"){
      g_sync.tab = vk==="ArrowLeft" ? 0 : 1; g_sync.err=""; g_sync.over=""; g_sync.ok="";
      playSfx("snd_menu_move");
      if (g_sync.tab===1 && !isTouch) focusInput(); else hideInput();
      return;
    }
    if (vk==="z"||vk==="Enter"){
      if (g_sync.tab===1) doImportSave(); else doExportCopy();
      return;
    }
    if (vk==="x"||vk==="Escape"||vk==="b"){
      hideInput(); g_inputMode=""; playSfx("snd_menu_move");
      openLogin(g_sync.prevUser || g_accountKey || "", !!g_sync.lock);
      return;
    }
    return;
  }
  // ---- 给存档设密码
  if (g_state===ST_SETPWD){
    if (vk==="ArrowUp" || vk==="ArrowDown"){
      g_setpwd.sel = 1 - g_setpwd.sel; g_setpwd.err = "";
      if (g_setpwd.sel===0) setInputMode("setPwd",  g_setpwd.pwd,  16, true);
      else                  setInputMode("setPwd2", g_setpwd.pwd2, 16, true);
      focusInput();
      playSfx("snd_menu_move");
    }
    if (vk==="z"||vk==="Enter") doSetPwd();
    if (vk==="x"||vk==="Escape"){ hideInput(); g_inputMode=""; playSfx("snd_menu_move"); GoTitle(); }
    return;
  }
  // ---- 首次进入：起名 / 设密码 / 选外貌
  if (g_state===ST_CREATE){
    if (g_createStage===0){
      if (vk==="z"||vk==="Enter") createConfirmName();
      // 已经有存档的人从标题点进来，B 可以放弃返回（新建到一半也能反悔）
      if (vk==="x"||vk==="Escape"){
        if (g_backup){
          const b=g_backup; g_backup=null;
          g_accountKey=b.key; g_profile=b.prof;
          hideInput(); GoTitle();
        } else if (g_accountKey){ hideInput(); GoTitle(); }
      }
      return;
    }
    if (g_createStage===1){
      if (vk==="z"||vk==="Enter") createConfirmPwd();
      if (vk==="x"||vk==="Escape"){ g_createStage=0; g_inputMode=""; g_createErr=""; focusInput(); }
      return;
    }
    if (vk==="ArrowLeft"){ g_createSel=(g_createSel+2)%CHARS.length; playSfx("snd_menu_move"); }
    if (vk==="ArrowRight"){ g_createSel=(g_createSel+1)%CHARS.length; playSfx("snd_menu_move"); }
    if (vk==="z"||vk==="Enter") createChooseSkin();
    if (vk==="x"||vk==="Escape"){ g_createStage = g_createNew?1:0; g_inputMode=""; }
    return;
  }
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
    if (isMember() && (g_state===ST_TITLE||g_state===ST_WIN||g_state===ST_LOSE||g_state===ST_SPARE||g_state===ST_INTRO)){ netLeave(); return; }
    if (net.invite){ netAcceptInvite(); return; }                // 同意邀请
    if ((g_state===ST_TITLE||g_state===ST_MENU) && !net.role){
      const L=netLobbyList();
      if (L.length && net.selIdx>0 && net.selIdx<=L.length){ netSendInvite(L[net.selIdx-1].cid); return; }
    }
    if (net.invSent){ Say("等待对方回应…"); return; }
  }
  if (vk==="x" && net.invite){ netDeclineInvite(); return; }     // 拒绝邀请
  // ---- 我的房间：B 收回手上的家具 / 没拿东西时才返回；R 旋转；E 开关身边的家具
  if (g_state===ST_ROOM){
    if (g_hold && (vk==="x"||vk==="b"||vk==="Escape"||vk==="Backspace")){ DropHold(); return; }
    if (g_hold && (vk==="r"||vk==="R")){ RotateHold(); return; }
    if (!g_hold && (vk==="e"||vk==="E")){ InteractRoom(); return; }
    if (vk==="Escape"||vk==="x"||vk==="b"){ playSfx("snd_menu_move"); GoTitle(); }
    if (g_hold && (vk==="z"||vk==="Enter"||vk===" ")) PlaceHold();
    return;
  }
  // ---- 主界面
  if (g_state===ST_TITLE){
    if (isMember()) return;                                      // 队员不能操作主界面
    if (vk==="r"){ playSfx("snd_menu_select"); net.selIdx=0; GoRoom(); return; }
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
    const n = g_sub===SM_ACT?3 : g_sub===SM_ITEM?itemList().length : 2;
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
      g_pendingDmg=Math.floor((16+acc*acc*acc*58)*dmgMul());   // 角色被动（Susie：伤害 +10%）
      if (g_buff.scythe){                            // 恶魔镰刀：这一次出刀伤害翻倍
        g_pendingDmg*=2; g_buff.scythe=false;
        setToast(`恶魔镰刀 —— 伤害 ×2（${g_pendingDmg}）`, "#d9a6ff");
        AddRing(JEV_CX, JEV_CY, 110, 200, 140, 255);
        AddShake(0.2,4);
      }
      g_barHit=true;
      g_actionKind="fight"; g_actionDmg=g_pendingDmg;
      startPAttack(0, g_pendingDmg>0?"fight":"miss");     // 自己冲出去砍一刀
      DoAttack(g_pendingDmg);
      if (g_jevHp>0){ g_state=ST_DMG; g_stateT=0; }        // 打死了就别覆盖成结算动作（否则看不到胜利画面）
    }
    break;
  case ST_WIN: case ST_LOSE: case ST_SPARE:
    if (isMember()) break;                                       // 成员等队长同步
    if (vk==="z"||vk==="Enter"){ playSfx("snd_menu_select"); StartBattle(g_boss); }   // 重开也要广播，队员才不会卡在结算画面
    break;
  }
  if (vk==="Escape" && g_state>=ST_INTRO && g_state!==ST_PAUSE) openPause();
}

window.addEventListener("keydown", e=>{
  TryResumeBgm();                                   // 浏览器要求先有用户操作，这里补放背景音乐
  if (document.activeElement === nameIn) return;    // 正在起名：键盘全给输入框
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
cv.addEventListener("contextmenu", e=>e.preventDefault());
cv.addEventListener("pointerdown", e=>{
  e.preventDefault();
  TryResumeBgm();
  const p = toLogical(e.clientX, e.clientY);
  g_mouse.x=p.x; g_mouse.y=p.y;
  if (e.button===2){                              // 右键：旋转手上的家具
    if (g_state===ST_ROOM && g_hold) RotateHold();
    return;
  }
  const id = vpadHit(p.x, p.y);
  if (id){                                       // 虚拟按键：按下即生效
    vptr.set(e.pointerId, id);
    if (id==="a"){ pressKey("z"); }
    else if (id==="b"){ pressBack(); }
    else { keys.add(VDIR[id]); pressKey(VDIR[id]); }
    return;
  }
  touchStart={...p, t:performance.now()};
});
// 手指不离开屏幕、直接在方向键之间滑 → 立刻换向（真十字键手感）
cv.addEventListener("pointermove", e=>{
  const mp = toLogical(e.clientX, e.clientY);
  g_mouse.x = mp.x; g_mouse.y = mp.y;             // 放置预览跟着指针走
  if (!PAD.on || !vptr.has(e.pointerId)) return;
  const cur = vptr.get(e.pointerId);
  if (cur === "a" || cur === "b") return;          // A/B 不做滑动跟随
  const p = toLogical(e.clientX, e.clientY);
  const nid = vpadHitDir(p.x, p.y) || "none";       // "none" = 还记着这根手指，但没压在任何方向键上
  if (nid === cur) return;
  if (cur !== "none") keys.delete(VDIR[cur]);
  vptr.set(e.pointerId, nid);
  if (nid !== "none"){ keys.add(VDIR[nid]); pressKey(VDIR[nid]); }
});
function endPointer(e){
  const id = vptr.get(e.pointerId);
  if (id !== undefined){                         // 松开虚拟方向键 → 立刻停
    vptr.delete(e.pointerId);
    if (id !== "none" && VDIR[id]) keys.delete(VDIR[id]);
    return;
  }
  if (!touchStart) return;
  const p = toLogical(e.clientX, e.clientY);
  const moved = Math.hypot(p.x-touchStart.x, p.y-touchStart.y);
  const isTap = moved < 14 && (performance.now()-touchStart.t) < 600;
  touchStart=null;
  if (!isTap) return;
  // 热区（从后往前 = 最上层优先）：只剩组队与暂停相关
  for (let i=hotspots.length-1;i>=0;--i){
    const h=hotspots[i];
    if (p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){ h.fn(); return; }
  }
}
cv.addEventListener("pointerup", e=>{ e.preventDefault(); endPointer(e); });
cv.addEventListener("pointercancel", e=>{
  const id = vptr.get(e.pointerId);
  if (id !== undefined){ vptr.delete(e.pointerId); if (id !== "none" && VDIR[id]) keys.delete(VDIR[id]); }
  touchStart=null;
});
window.addEventListener("blur", ()=>{ keys.clear(); vptr.clear(); });   // 切走时别让心一直往一个方向跑

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
  VSC = WINW / Math.max(1, ww);                     // 1 CSS px 对应的舞台逻辑长度
  crtDirty = true;
  // 画布缓冲按逻辑尺寸等比放大：x/y 缩放比完全一致，
  // 不会因为 innerHeight/innerWidth 的取整差异把底部按钮挤出可视区
  cv.width  = Math.max(1, Math.round(WINW*Math.min(SS,1.5)));
  cv.height = Math.max(1, Math.round(WINH*Math.min(SS,1.5)));
  cv.style.width  = ww + "px";
  cv.style.height = wh + "px";
  const hint = document.getElementById("rotate");
  if (hint) hint.style.display = "none";     // 竖屏也能全屏显示，不再强制横屏
  try {
    const pp = getComputedStyle(document.documentElement).getPropertyValue("--sab").trim();
    SAFE_B = parseFloat(pp) || 0;
  } catch(e){ SAFE_B = 0; }
  vpadLayout();                              // 虚拟按键跟着屏幕尺寸重排
  avatarLayout();                            // 右上角头像也跟着重排
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
function rightPillText(s, rx, y, size, color){          // 带一层半透明底：战斗背景很亮时也看得清
  ctx.font = `bold ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;
  const w = ctx.measureText(s).width + 16;
  ctx.fillStyle = "rgba(10,8,20,0.55)";
  roundRect(rx-w, y-4, w, size+9, 7); ctx.fill();
  rightText(s, rx-8, y, size, color);
}

// ---- 道具小图标（纯矢量，尺寸按 s 缩放，中心 cx,cy）
function drawItemIcon(key, cx, cy, s){
  const k = s/32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap="round"; ctx.lineJoin="round";
  if (key==="scythe"){
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=3*k;
    ctx.beginPath(); ctx.moveTo(-7*k,13*k); ctx.lineTo(7*k,-8*k); ctx.stroke();
    ctx.strokeStyle="#c887ff"; ctx.lineWidth=5*k;
    ctx.beginPath(); ctx.arc(9*k,-7*k, 11*k, Math.PI*0.90, Math.PI*1.90); ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1.6*k;
    ctx.beginPath(); ctx.arc(9*k,-7*k, 11*k, Math.PI*0.95, Math.PI*1.82); ctx.stroke();
  } else if (key==="tv"){
    ctx.strokeStyle="#9ad6ff"; ctx.lineWidth=2*k;
    ctx.beginPath(); ctx.moveTo(-4*k,-6*k); ctx.lineTo(-9*k,-14*k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4*k,-6*k);  ctx.lineTo(9*k,-14*k);  ctx.stroke();
    ctx.fillStyle="#243a52"; ctx.strokeStyle="#6fe0ff"; ctx.lineWidth=2.4*k;
    roundRect(-12*k,-7*k, 24*k, 18*k, 3*k); ctx.fill(); ctx.stroke();
    ctx.fillStyle="rgba(150,240,255,0.45)"; ctx.fillRect(-9*k,-4*k, 13*k, 12*k);
  } else if (key==="fuse"){
    ctx.strokeStyle="#e8b070"; ctx.lineWidth=3*k;
    ctx.beginPath();
    for (let i=0;i<=10;++i){ const t=i/10; ctx.lineTo(-13*k+t*20*k, Math.sin(t*7)*5*k); }
    ctx.stroke();
    ctx.fillStyle="#ffd257";
    for (let i=0;i<5;++i){
      const a=i*1.2566+0.3;
      ctx.beginPath(); ctx.arc(10*k+Math.cos(a)*5*k, Math.sin(a)*5*k, 1.8*k, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle="#ff8a3c";
    ctx.beginPath(); ctx.arc(10*k,0,3.2*k,0,6.2832); ctx.fill();
  } else {
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=3*k;
    ctx.beginPath(); ctx.moveTo(3*k,-13*k); ctx.lineTo(12*k,5*k); ctx.stroke();
    ctx.fillStyle="#ff7ac8"; ctx.strokeStyle="#ffd0ec"; ctx.lineWidth=2*k;
    ctx.beginPath(); ctx.ellipse(0,5*k, 10*k, 8*k, -0.6, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#3a1430";
    ctx.beginPath(); ctx.arc(0,5*k, 3*k, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
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

// ---------------- 档案：右上角常驻头像 ----------------
function avatarLayout(){                       // 屏幕/角色变了就重排（尺寸按 CSS 像素定）
  AVATAR.on = (g_profile.skin>=0 && g_profile.skin<CHARS.length);
  if (!AVATAR.on) return;
  const ww = document.documentElement.clientWidth  || WINW;
  const wh = document.documentElement.clientHeight || WINH;
  const c  = CHARS[g_profile.skin];
  const im = IMG[c.img];
  const fw = (im && im.naturalWidth)  ? im.naturalWidth/c.frames : 72;
  const fh = (im && im.naturalHeight) ? im.naturalHeight         : 78;
  const h  = clamp(Math.min(ww,wh)*0.17, 50, 84) * VSC;
  const pad = 7*VSC;
  AVATAR.h = h;
  AVATAR.w = fw/fh*h;
  AVATAR.pad = pad;
  AVATAR.x = WINW - 8*VSC - pad - AVATAR.w;
  AVATAR.y = 8*VSC + pad;
}

// 画一帧待机动画；hgt=显示高度，maxW 给个上限免得宽角色（Susie 带斧头）撑破卡片
function drawCharFrame(i, cx, cy, hgt, maxW){
  const c  = CHARS[i] || CHARS[0];
  const im = IMG[c.img];
  if (!im || !im.naturalWidth) return;
  const n=c.frames, fw=im.naturalWidth/n, fh=im.naturalHeight;
  const f=Math.floor(g_animT*7)%n;
  let sc=hgt/fh;
  if (maxW && fw*sc>maxW) sc=maxW/fw;
  const w=fw*sc, hh=fh*sc;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(im, f*fw, 0, fw, fh, cx-w/2, cy-hh/2, w, hh);
  ctx.restore();
}

// ---------------- 场上的角色（左侧）与 Boss（右侧） ----------------
const PATK = [null, null];                     // 两个槽位的出刀动画：{t,dur,kind}
const PF_SOLO = { x:282, h:128 };              // 单人：站在 Boss 左前方（不冲刺）
const PF_DUO  = [{ x:272, h:120 }, { x:162, h:100 }];   // 组队：0=自己（靠 Boss）、1=队友（后排）

function partnerSkin(){
  if (!net.role) return -1;
  const k=net.pSkin;
  if (k!==undefined && k>=0 && k<CHARS.length) return k;
  return (Math.max(0,g_profile.skin)+1)%CHARS.length;   // 还没收到对方档案：先挑一个不同的
}
function mySkin(){
  return (g_profile.skin>=0 && g_profile.skin<CHARS.length) ? g_profile.skin : 0;
}
function fighterList(){                        // 当前场上的人
  if (!net.role) return [{ i:0, skin:mySkin(), x:PF_SOLO.x, h:PF_SOLO.h, dead:g_dead,
                           name:g_profile.name||"" }];
  return [
    { i:0, skin:mySkin(),      x:PF_DUO[0].x, h:PF_DUO[0].h, dead:g_dead,
      name:g_profile.name||"你" },
    { i:1, skin:partnerSkin(), x:PF_DUO[1].x, h:PF_DUO[1].h, dead:net.pDead,
      name:net.partnerName||"" },
  ];
}
function layoutFighters(){                     // Boss 立绘按「脚踩地面线」重算，太高就缩放
  let bw=158, bh=168;
  if (g_boss===1){ bw=220; bh=340; }
  else if (g_boss===2){ bw=236; bh=336; }
  else if (g_boss===3){ bw=210; bh=215; }
  const k=Math.min(1, (GROUND_Y-14)/bh);
  JEV_W=bw*k; JEV_H=bh*k;
  JEV_CX=P_HOME_X; JEV_CY=GROUND_Y - JEV_H/2;
}
function startPAttack(who, kind){
  if (who===1 && !net.role) return;
  const f=fighterList().find(x=>x.i===who);
  if (f && f.dead) return;
  PATK[who]={ t:0, dur: kind==="fight"?0.44:0.38, kind:kind||"fight" };
}
function updatePAttack(dt){
  for (let i=0;i<2;i++){
    const a=PATK[i];
    if (!a) continue;
    a.t+=dt;
    if (a.t>=a.dur) PATK[i]=null;
  }
}
function pAtkOffset(a, dash){                  // 冲出去 → 顿一下 → 收回
  if (!a) return 0;
  const p=clamp(a.t/a.dur,0,1);
  if (p<0.26){ const q=p/0.26; return dash*(1-Math.pow(1-q,3)); }   // 冲刺：先快后慢
  if (p<0.58) return dash;
  const q=(p-0.58)/0.42; return dash*Math.pow(1-q,2.0);             // 收回：起步快、落位稳
}
function drawFighters(){
  // 结算画面（GAME OVER / 胜利）有整屏覆盖文字，角色画上去只会变成残影
  if (g_state===ST_LOSE || g_state===ST_WIN || g_state===ST_SPARE) return;
  const list=fighterList().slice().sort((a,b)=>a.h-b.h);   // 小的（远的）先画
  // 开场：角色从左侧走进来
  let inK=1;
  if (g_state===ST_INTRO) inK=Math.min(1, g_stateT/0.75);
  for (const f of list){
    const c=CHARS[f.skin]||CHARS[0], im=IMG[c.img];
    if (!im || !im.naturalWidth) continue;
    const n=c.frames, fw=im.naturalWidth/n, fh=im.naturalHeight;
    const sc=f.h/fh, w=fw*sc, hh=fh*sc;        // 像素缩放：待机与挥刀共用同一比例
    const a=PATK[f.i];
    const bob=Math.sin(g_animT*3+f.i*1.7)*2.0;
    const lx=f.x-w/2-(1-inK)*70;               // 帧左缘基准（原版按帧左上角对齐）
    // 影子
    ctx.save();
    ctx.fillStyle="rgba(8,4,16,0.34)";
    ctx.beginPath(); ctx.ellipse(f.x-(1-inK)*70, GROUND_Y+2, Math.max(18,w*0.40), 5.5, 0, 0, 6.29); ctx.fill();
    ctx.restore();
    if (f.dead){                                // 倒地：身体平躺在地面线上
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.globalAlpha=0.70;
      ctx.translate(f.x-(1-inK)*70, GROUND_Y-w*0.42);
      ctx.rotate(1.50);
      ctx.drawImage(im, 0, 0, fw, fh, -w/2, -hh, w, hh);
      ctx.restore();
      continue;
    }
    const aim = (a && c.atk) ? IMG[c.atk] : null;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    if (inK<1) ctx.globalAlpha=inK;
    if (aim && aim.naturalWidth){
      // 攻击：整段换成原版挥刀动画，原地播放、帧底贴地
      const an=c.atkN||1, afw=aim.naturalWidth/an, afh=aim.naturalHeight;
      const p=clamp(a.t/a.dur,0,1);
      const fr=Math.min(an-1, Math.floor(p*an*1.02));
      const asc=sc*(c.atkS||1), aw2=afw*asc, ah2=afh*asc;
      ctx.drawImage(aim, fr*afw, 0, afw, afh, lx-((aw2-afw*sc)/2), GROUND_Y-ah2, aw2, ah2);
    } else {
      // 待机：循环动画，轻微呼吸浮动
      const fr=Math.floor(g_animT*7+f.i*3)%n;
      ctx.drawImage(im, fr*fw, 0, fw, fh, lx, GROUND_Y+bob-hh, w, hh);
    }
    ctx.restore();
    // 名字（让人一眼看出哪个是自己/队友）
    if (f.name && !a){
      outlineText(f.name, 0, GROUND_Y-hh-15, 13, f.i===0?"#ffc9d2":"#a9d8ff",
                  f.x-(1-inK)*70, false);
    }
  }
}
function drawAvatar(){
  if (!AVATAR.on || g_state===ST_CREATE || g_state===ST_LOGIN || g_state===ST_SETPWD || g_state===ST_SIGNUP) return;
  const p=AVATAR.pad, x=AVATAR.x-p, y=AVATAR.y-p;
  const w=AVATAR.w+p*2, h=AVATAR.h+p*2;
  ctx.save();
  roundRect(x,y,w,h,9);
  ctx.fillStyle="rgba(10,8,20,0.34)"; ctx.fill();
  ctx.strokeStyle=g_state===ST_TITLE ? "rgba(255,232,120,0.55)" : "rgba(190,206,255,0.30)";
  ctx.lineWidth=1.6; ctx.stroke();
  ctx.restore();
  drawCharFrame(g_profile.skin, AVATAR.x+AVATAR.w/2, AVATAR.y+AVATAR.h/2, AVATAR.h);
  if (g_state===ST_TITLE) hot(x-6, y-6, w+12, h+12, openCreate);   // 标题界面点头像 = 重新起名/换外貌
}

// ---------------- 隐藏输入框：起名 / 密码 / 登录共用同一个 ----------------
const nameIn = document.getElementById("nameIn");
let g_inputMode = "";                 // name | createPwd | loginUser | loginPwd

function setInputMode(mode, value, maxLen, force){
  if (!nameIn) return;
  if (g_inputMode === mode && !force) return;
  g_inputMode = mode;
  nameIn.type = (mode==="loginPwd" || mode==="createPwd" || mode==="setPwd" || mode==="setPwd2" || mode==="suPwd") ? "password" : "text";
  nameIn.maxLength = maxLen || (mode==="name" ? 12 : (mode==="loginUser"||mode==="suEmail" ? 64 : 16));
  nameIn.value = value || "";
}
function placeInput(mode, value, bx, by, bw, bh, maxLen){
  if (!nameIn) return;
  setInputMode(mode, value, maxLen, false);
  const r = cv.getBoundingClientRect();
  const sx = r.width/WINW, sy = r.height/WINH;
  nameIn.style.left   = (r.left + bx*sx) + "px";
  nameIn.style.top    = (r.top  + by*sy) + "px";
  nameIn.style.width  = (bw*sx) + "px";
  nameIn.style.height = (bh*sy) + "px";
  nameIn.style.pointerEvents = "auto";
}
function hideInput(){
  if (!nameIn) return;
  if (nameIn.style.pointerEvents !== "none") nameIn.style.pointerEvents = "none";
  if (document.activeElement === nameIn) nameIn.blur();
}
function focusInput(){
  if (!nameIn) return;
  try { nameIn.focus({preventScroll:true}); } catch(e){ try { nameIn.focus(); } catch(_){} }
}
if (nameIn){
  nameIn.addEventListener("input", ()=>{
    const v = nameIn.value;
    if (g_inputMode==="loginUser")       g_login.user = v.slice(0,64);
    else if (g_inputMode==="loginPwd")   g_login.pwd  = v.slice(0,32);
    else if (g_inputMode==="suEmail")    g_su.email   = v.slice(0,64);
    else if (g_inputMode==="suCode"){    g_su.code    = v.replace(/\D/g,"").slice(0,8); }
    else if (g_inputMode==="suPwd")      g_su.pwd     = v.slice(0,32);
    else if (g_inputMode==="createPwd")  g_createPwd = v.slice(0,16);
    else if (g_inputMode==="setPwd")     g_setpwd.pwd  = v.slice(0,16);
    else if (g_inputMode==="setPwd2")    g_setpwd.pwd2 = v.slice(0,16);
    else if (g_inputMode==="syncCode"){  g_sync.code = v.slice(0,600); g_sync.over = ""; syncCheck(); }
    else                                 g_createName = v.slice(0,12);
    g_login.err = ""; g_createErr = ""; g_setpwd.err = ""; g_su.err = "";
  });
  nameIn.addEventListener("keydown", e=>{
    e.stopPropagation();                      // 打字别触发游戏按键
    if (e.key==="Enter"){
      e.preventDefault();
      if (g_inputMode==="loginUser" || g_inputMode==="loginPwd") doLogin();
      else if (g_inputMode==="suEmail" || g_inputMode==="suCode" || g_inputMode==="suPwd") suSubmit();
      else if (g_inputMode==="setPwd" || g_inputMode==="setPwd2") doSetPwd();
      else if (g_inputMode==="createPwd") createConfirmPwd();
      else createConfirmName();
    } else if (e.key==="Escape"){ e.preventDefault(); nameIn.blur(); }
    else if (e.key==="ArrowUp" || e.key==="ArrowDown" || e.key==="Tab"){ e.preventDefault(); pressKey(e.key); }
  });
}

// ---- 登录 / 云账号 ----
function openLogin(prefillUser, lock){
  g_login = { user: prefillUser||g_cloud.email||"", pwd:"", sel: prefillUser?1:0,
              err:"", lock:false, ok:"", wipeAsk:false, wipeT:0 };
  g_inputMode = "";                            // 强制下一次渲染重建输入框
  g_state = ST_LOGIN; g_stateT = 0;
  Say(""); BgmStop(); crtDirty = true;
  if (!isTouch) setTimeout(()=>focusInput(), 60);
}
function doLogin(){ cloudLogin(); }             // 兼容旧调用点（Z / Enter / 按钮）
function newAccountFromLogin(){
  hideInput();
  openSignup("reg");
}

// ---- 注册 / 重设密码：邮箱验证码 + 密码 ----
let g_su = { mode:"reg", email:"", code:"", pwd:"", sel:0,
             vid:"", handle:null, exist:false, sent:false, busy:false,
             err:"", ok:"", cool:0, coolT:0 };
function openSignup(mode){
  if (!cloudHostOk()) return;              // 非应用域名：登录页已改成引导页，这里不再进入
  g_su = { mode: mode==="reset" ? "reset" : "reg", email:(g_login.user||g_cloud.email||"").trim().toLowerCase(),
           code:"", pwd:"", sel:0, vid:"", handle:null, exist:false, sent:false, busy:false,
           err:"", ok:"", cool:0, coolT:0 };
  g_inputMode = "";
  g_state = ST_SIGNUP; g_stateT = 0;
  Say(""); BgmStop(); crtDirty = true;
  if (!isTouch) setTimeout(()=>focusInput(), 60);
}
function suCoolLeft(){
  if (!g_su.cool) return 0;
  const left = g_su.cool - Math.floor((performance.now() - g_su.coolT)/1000);
  return left > 0 ? left : 0;
}
async function suSendCode(){
  if (g_su.busy) return;
  if (!cloudHostOk()){ g_su.err = "这个网址不支持云账号，回登录页点「打开云账号版」"; g_su.ok=""; return; }
  const email = (g_su.email||"").trim().toLowerCase();
  if (!cloudEmailOk(email)){ g_su.err = "邮箱格式不对"; g_su.ok=""; return; }
  if (suCoolLeft() > 0) return;
  const c = cloudClient();
  if (!c){ g_su.err = "云账号组件还在加载，等两秒再点"; g_su.ok=""; return; }
  g_su.busy = true; g_su.err = ""; g_su.ok = "正在发送验证码…";
  playSfx("snd_menu_select");
  let r;
  try {
    r = g_su.mode==="reset" ? await c.auth.resetPasswordForEmail(email)
                            : await c.auth.sendOtp({ email });
  } catch(e){ r = { error:e }; }
  g_su.busy = false; g_su.ok = "";
  if (!r || r.error){ g_su.err = cloudErrText(r && r.error, "验证码发不出去"); return; }
  if (g_su.mode==="reset"){
    g_su.handle = r.data;
    g_su.ok = "验证码已发到邮箱（没收到就翻一下垃圾箱）";
  } else {
    g_su.vid = (r.data && r.data.verificationId) || "";
    g_su.exist = !!(r.data && r.data.isExistingUser);
    g_su.ok = g_su.exist ? "这个邮箱已经注册过了：退回登录页直接登" : "验证码已发到邮箱（没收到就翻一下垃圾箱）";
  }
  g_su.sent = true;
  g_su.cool = 60; g_su.coolT = performance.now();
  playSfx("snd_menu_select");
}
async function suSubmit(){
  if (g_su.busy) return;
  const email = (g_su.email||"").trim().toLowerCase();
  const code  = (g_su.code||"").replace(/\D/g,"");
  const pwd   = g_su.pwd || "";
  if (!cloudEmailOk(email)){ g_su.err = "邮箱格式不对"; g_su.ok=""; return; }
  if (g_su.mode==="reg" && g_su.exist){ g_su.err = "这个邮箱已经有账号了，回去点「登录」"; g_su.ok=""; return; }
  if (!g_su.sent || !code){ g_su.err = "先点「发送验证码」，再把收到的数字填进来"; g_su.ok=""; return; }
  if (pwd.length < 6){ g_su.err = "密码至少 6 位"; g_su.ok=""; return; }
  const c = cloudClient();
  if (!c){ g_su.err = "云账号组件还在加载，等两秒再点"; g_su.ok=""; return; }
  g_su.busy = true; g_su.err = ""; g_su.ok = "正在验证…";
  playSfx("snd_menu_select");
  let r;
  try {
    if (g_su.mode==="reset"){
      if (!g_su.handle){ g_su.busy=false; g_su.ok=""; g_su.err = "先点「发送验证码」"; return; }
      r = await g_su.handle.updateUser({ nonce: code, password: pwd });
    } else {
      r = await c.auth.verifyOtp({ email, verificationId: g_su.vid,
                                   isExistingUser:false, token: code, password: pwd });
    }
  } catch(e){ r = { error:e }; }
  g_su.busy = false; g_su.ok = "";
  if (!r || r.error){ g_su.err = cloudErrText(r && r.error, "验证没通过"); return; }
  if (g_su.mode==="reset") setToast("密码已改，用新密码登录就行", "#8ff0b8");
  await cloudEnter((r.data && r.data.user) || { email });
}
function askWipePwd(){                          // 两步确认后清掉本机密码（存档本身不删）
  const now = performance.now();
  if (!g_login.wipeAsk || now - g_login.wipeT > 6000){
    g_login.wipeAsk = true; g_login.wipeT = now;
    g_login.err = "";
    playSfx("snd_menu_move");
    return;
  }
  const u = g_accountKey || g_login.user;
  const accounts = loadAccounts();
  if (!accounts[u]){ g_login.err = "存档读不出来"; g_login.wipeAsk = false; return; }
  accounts[u].pwd = "";
  saveAccounts(accounts);
  g_profile.pwd = "";
  g_login.wipeAsk = false;
  hideInput();
  applyAccount(u);
  playSfx("snd_menu_select");
  Say("");
  GoTitle();
}
// 旧的「本机账号登录」已由云端账号取代：doLogin / newAccountFromLogin 定义在上面。
// 本机账号表仍然保留，但只作为缓存（键 "u:<云端 uid>"），不再作为登录凭据。

// ---- 给存档设密码（老存档迁移过来时 pwd 为空，就是靠这里补上） ----
function openSetPwd(){
  if (!g_accountKey) return false;
  g_setpwd = { pwd:"", pwd2:"", sel:0, err:"", ok:"" };
  g_inputMode = "";
  g_state = ST_SETPWD; g_stateT = 0;
  Say(""); BgmStop(); crtDirty = true;
  if (!isTouch) setTimeout(()=>focusInput(), 60);
  return true;
}
function doSetPwd(){
  const a = (nameIn && g_inputMode==="setPwd")  ? nameIn.value : g_setpwd.pwd;
  const b = (nameIn && g_inputMode==="setPwd2") ? nameIn.value : g_setpwd.pwd2;
  g_setpwd.pwd = (a||"").slice(0,16);
  g_setpwd.pwd2 = (b||"").slice(0,16);
  if (g_setpwd.pwd.length < 4){ g_setpwd.err = "密码至少 4 位"; g_setpwd.sel=0; return; }
  if (g_setpwd.pwd !== g_setpwd.pwd2){ g_setpwd.err = "两次输入不一样，再确认一次"; g_setpwd.sel=1; g_setpwd.pwd2=""; return; }
  const u = g_accountKey;
  const accounts = loadAccounts();
  if (!accounts[u]){ g_setpwd.err = "存档读不出来，回标题重试"; return; }
  accounts[u].pwd = hashPwd(g_setpwd.pwd);
  saveAccounts(accounts);
  g_profile.pwd = accounts[u].pwd;             // 下次启动就会要密码才能进
  trustDevice(u);                              // 刚在本机设的密码：这台设备直接免登录
  g_setpwd.err = ""; g_setpwd.ok = "密码已保存";
  hideInput(); g_inputMode = "";
  playSfx("snd_menu_select");
  setToast(`存档「${accounts[u].name||u}」已设好密码 —— 下次进入要输它`, "#8ff0b8");
  setTimeout(()=>{ if (g_state===ST_SETPWD) GoTitle(); }, 900);
}

function openCreate(fromLogin){
  if (!fromLogin) g_backup = null;
  g_state=ST_CREATE; g_stateT=0; g_createStage=0;
  g_createNew = !g_accountKey;                 // 已有账号 = 改名/换外貌，不再设密码
  g_createPwd = ""; g_createErr = "";
  g_createName = g_profile.name || "";
  g_createSel = (g_profile.skin>=0 ? g_profile.skin : 0);
  g_inputMode = "";                            // 强制重建输入框
  Say(""); BgmStop(); crtDirty = true;
  if (!isTouch) setTimeout(()=>focusInput(), 60);   // 桌面直接可打字
}
function createConfirmName(){
  let n = (nameIn ? nameIn.value : g_createName) || "";
  n = n.replace(/\s+/g," ").trim().slice(0,12);
  if (!n){ g_createErr = "名字不能是空的"; return; }
  if (!g_cloud.uid){                           // 云端账号下名字只是显示名，不参与登录，不用查重
    const accounts = loadAccounts();
    if (accounts[n] && n !== g_accountKey){    // 本机离线存档：名字就是钥匙，撞号会混在一起
      g_createErr = "这个名字已经有存档了，换一个或去登录";
      return;
    }
  }
  g_createName = n;
  if (nameIn) nameIn.blur();
  g_createErr = "";
  g_createStage = (g_createNew && !g_cloud.uid) ? 1 : 2;   // 新建 → 设密码；云端账号 / 改名 → 直接选外貌
  g_inputMode = "";
  playSfx("snd_menu_select");
  if (g_createStage===1){
    setInputMode("createPwd", "", 16, true);   // 进入密码阶段：输入框立刻改绑密码字段
    setTimeout(()=>focusInput(), 60);
  }
}
function createConfirmPwd(){
  const p = (nameIn ? nameIn.value : g_createPwd) || "";
  if (p.length < 4){ g_createErr = "密码至少 4 位"; return; }
  g_createPwd = p.slice(0,16);
  g_createErr = "";
  if (nameIn) nameIn.blur();
  g_createStage = 2;                           // → 选外貌
  g_inputMode = "";
  playSfx("snd_menu_select");
}
function createChooseSkin(){
  if (g_createName) g_profile.name = g_createName;
  g_profile.skin = g_createSel;
  if (g_cloud.uid){                            // 云端账号：键固定是 u:<uid>，改名不动键
    g_accountKey = cloudKey();
    saveProfile();
    cloudPushSoon(250);                        // 新档案立刻传上去
    hideInput();
    net.name = g_profile.name;
    try { localStorage.setItem("sj_name", net.name); } catch(e){}
    netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s:"lobby", ts:Date.now(), i:net.inst, k:g_profile.skin});
    avatarLayout();
    playSfx("snd_menu_select");
    g_createNew = false;
    g_backup = null;
    setToast("存档已同步到云端", "#8ff0b8");
    GoTitle();
    return;
  }
  if (g_createNew) g_profile.pwd = hashPwd(g_createPwd);
  // 改名 → 账号表的键跟着换
  const oldKey = g_accountKey, newKey = g_profile.name;
  if (oldKey && newKey && oldKey !== newKey){
    const accounts = loadAccounts();
    if (accounts[oldKey]){ delete accounts[oldKey]; saveAccounts(accounts); }
  }
  g_accountKey = newKey;
  saveProfile();
  if (g_profile.pwd) trustDevice(newKey);      // 刚建好的带密码账号：本机免登录
  hideInput();
  net.name = g_profile.name;                   // 组队邀请里显示的就是这个名字
  try { localStorage.setItem("sj_name", net.name); } catch(e){}
  netPub(NET_BASE+"/p/"+net.cid, {n:net.name, s:"lobby", ts:Date.now(), i:net.inst, k:g_profile.skin});
  avatarLayout();
  playSfx("snd_menu_select");
  g_createNew = false;
  g_backup = null;
  GoTitle();
}
// 输入框的摆位/切换统一走 placeInput()（见上：起名、设密码、登录共用同一个隐藏 input）

function RenderCreate(){
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2;

  if (g_createStage===0){
    const raw = (nameIn && g_inputMode==="name") ? nameIn.value : (g_createName||"");
    const shown = (raw||"").replace(/\s+/g," ");
    outlineText("新 的 旅 途", 0, 40+VOY, 17, "#9fb4e8", cx, false);
    outlineText("你 叫 什 么 名 字 ？", 0, 78+VOY, 40, "#ffec78", cx);
    const bw = Math.min(470, WINW-70), bh = 78, bx = cx-bw/2, by = 168+VOY;
    ctx.fillStyle="rgba(12,10,24,0.85)"; ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle="#8fb6ff"; ctx.lineWidth=2.5; ctx.strokeRect(bx,by,bw,bh);
    placeInput("name", shown, bx, by, bw, bh, 12);
    if (shown){
      ctx.save();
      ctx.font = `bold 30px "Microsoft YaHei","PingFang SC",sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="#fff"; ctx.fillText(shown, cx, by+bh/2);
      const tw = ctx.measureText(shown).width;
      ctx.restore();
      if (document.activeElement===nameIn && (Math.floor(performance.now()/500)%2===0))
        ctx.fillRect(cx+tw/2+4, by+bh/2-17, 3, 34);
    } else {
      outlineText(isTouch?"点 这 里 输 入 名 字":"点框里输入名字 或直接打字", 0, by+bh/2-12, 22, "rgba(180,196,230,0.5)", cx, false);
    }
    outlineText(isTouch?"输入完点键盘上的「完成」，或按 A 确定":"输入后按 Z / Enter 确定", 0, 268+VOY, 15, "#b4d2ff", cx, false);
    outlineText(g_createNew ? "这个名字也是你的登录用户名" : "名字随便起，组队时队友看到的就是它", 0, 294+VOY, 13, "#8ea2d8", cx, false);
    if (g_createErr) outlineText(g_createErr, 0, 320+VOY, 14, "#ff8a8a", cx, false);
  } else if (g_createStage===1){
    const pwd = (nameIn && g_inputMode==="createPwd") ? nameIn.value : (g_createPwd||"");
    outlineText("设 一 个 密 码", 0, 78+VOY, 40, "#ffec78", cx);
    outlineText("以后进游戏要用「名字 + 密码」登录，记牢哦", 0, 136+VOY, 15, "#9fb4e8", cx, false);
    const bw = Math.min(470, WINW-70), bh = 72, bx = cx-bw/2, by = 180+VOY;
    ctx.fillStyle="rgba(12,10,24,0.85)"; ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle="#8fb6ff"; ctx.lineWidth=2.5; ctx.strokeRect(bx,by,bw,bh);
    placeInput("createPwd", pwd, bx, by, bw, bh, 16);
    if (pwd){
      const dots = "●".repeat(Math.min(pwd.length,16));
      outlineText(dots, 0, by+bh/2-14, 26, "#fff", cx, false);
      rightText(`${pwd.length}/16`, bx+bw-12, by+10, 11, "rgba(160,180,220,0.6)", false);
    } else {
      outlineText(isTouch?"点 这 里 输 入 密 码":"点框里输入密码 或直接打字", 0, by+bh/2-12, 22, "rgba(180,196,230,0.5)", cx, false);
    }
    outlineText("至少 4 位，最多 16 位", 0, 266+VOY, 14, "#b4d2ff", cx, false);
    if (g_createErr) outlineText(g_createErr, 0, 296+VOY, 15, "#ff8a8a", cx, false);
    outlineText(isTouch?"A 确定　B 改名":"Z 确定　X 改名", 0, 350+VOY, 15, "#d2dce1", cx, false);
  } else {
    outlineText("选 一 个 样 子", 0, 38+VOY, 34, "#ffec78", cx);
    outlineText("名字："+(g_createName||"KRIS"), 0, 86+VOY, 16, "#c8dcff", cx, false);
    const cw=152, chh=212, gap=34, x0=cx-(cw*3+gap*2)/2, y0=120+VOY;
    for (let i=0;i<3;i++){
      const x=x0+i*(cw+gap), y=y0, sel=(i===g_createSel);
      ctx.fillStyle = sel ? "rgba(52,30,62,0.95)" : "rgba(20,16,34,0.82)";
      ctx.fillRect(x,y,cw,chh);
      ctx.strokeStyle = sel ? "#ffe878" : "rgba(130,130,160,0.55)";
      ctx.lineWidth = sel?3:1.5; ctx.strokeRect(x,y,cw,chh);
      drawCharFrame(i, x+cw/2, y+92+(sel?Math.sin(g_animT*4)*3:0), 104, cw-20);
      outlineText(CHARS[i].label, 0, y+168, 20, sel?"#fff08c":"#d6d2dc", x+cw/2);
      // 专属技能名（战斗里在 ACT 第一项使用，消耗一回合，每局一次）+ 角色被动
      outlineText(`★ ${SKILLS[i].name}·每局1次`, 0, y+181, 10.5,
                  sel?"#ffc9d8":"rgba(185,198,222,0.72)", x+cw/2, false);
      outlineText(`被动：${CHARS[i].passive}`, 0, y+197, 9.5,
                  sel?"rgba(165,228,255,0.95)":"rgba(158,176,205,0.72)", x+cw/2, false);
      hot(x,y,cw,chh, ()=>{ g_createSel=i; playSfx("snd_menu_move"); });
    }
    outlineText(isTouch?"← → 选择　A 确定　B 改名":"← → 选择　Z 确定　X 改名", 0, 352+VOY, 15, "#d2dce1", cx, false);
  }
  if (g_createStage>1) hideInput();          // 选外貌时不需要输入框
  outlineText(isTouch?"A 确定":"Z 确定", 0, WINH-26, 12, "rgba(140,160,210,0.65)", cx, false);
}

// ---- 登录页
function loginBox(x, y, w, h, active, value, placeholder, mask){
  ctx.fillStyle = active ? "rgba(24,20,44,0.96)" : "rgba(14,12,26,0.86)";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle = active ? "#ffe878" : "rgba(130,150,190,0.5)";
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.strokeRect(x,y,w,h);
  const text = mask ? "●".repeat(Math.min((value||"").length,16)) : (value||"");
  if (text){
    outlineText(text, x+18, y+h/2-13, 24, "#fff", -1);
  } else {
    outlineText(placeholder, x+18, y+h/2-10, 18, "rgba(150,170,210,0.55)", -1, false);
  }
  // 当前焦点：边框呼吸一下，提示可以打字
  if (active){
    const a = 0.35 + 0.35*Math.sin(performance.now()/260);
    ctx.strokeStyle = `rgba(255,232,120,${a})`;
    ctx.lineWidth = 4; ctx.strokeRect(x-2,y-2,w+4,h+4);
  }
}
// ---------------- 存档搬运（换电脑用） ----------------
// 存档只存在这台电脑的浏览器里（localStorage），换电脑/换浏览器/清缓存就是一张空表，
// 所以直接登录必然说「没这个用户名」。这里给一盘「存档码」：旧电脑导出，新电脑粘贴导入，
// 账号（含密码哈希）原样搬过去，之后照常用用户名 + 密码登录。
// 码 = SJ1 + 4 位校验 + base64url(JSON)，抄漏几位会直接报「不完整」而不是静默出错。
const SAVE_CODE_PRE = "SJ1";
function b64u(bytes){
  let s = "";
  for (let i=0;i<bytes.length;++i) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unb64u(str){
  let s = String(str||"").replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;++i) out[i] = bin.charCodeAt(i);
  return out;
}
function codeSum(body){                       // 4 位 base36 校验：抄漏字符能被发现
  let h = 5381;
  for (let i=0;i<body.length;++i) h = (Math.imul(h, 33) + body.charCodeAt(i)) >>> 0;
  return ("000" + h.toString(36)).slice(-4);
}
function encodeSaveCode(acc){
  if (!acc) return "";
  const bits = a => [0,1,2,3].map(i => (a && a[i]) ? 1 : 0).join("");
  const o = { v:1, n:acc.name || "", s:acc.skin|0, p:acc.pwd || "",
              c:bits(acc.cleared), r:bits(acc.spared) };
  const body = b64u(new TextEncoder().encode(JSON.stringify(o)));
  return SAVE_CODE_PRE + codeSum(body) + body;
}
function decodeSaveCode(raw){
  const s = String(raw||"").replace(/\s+/g,"");
  if (!s) return { err:"先把存档码粘贴到上面的框里" };
  if (s.length < 14) return { err:"存档码太短，可能没复制全" };
  if (s.slice(0,3) !== SAVE_CODE_PRE) return { err:"这不是存档码（要以 SJ1 开头）" };
  const sum = s.slice(3,7), body = s.slice(7);
  if (codeSum(body) !== sum) return { err:"存档码不完整：少复制或多了字符" };
  let o;
  try { o = JSON.parse(new TextDecoder().decode(unb64u(body))); }
  catch(e){ return { err:"存档码读不出来，可能复制时被打乱了" }; }
  if (!o || typeof o!=="object") return { err:"存档码读不出来" };
  const name = String(o.n||"").replace(/\s+/g," ").trim().slice(0,12);
  if (!name) return { err:"存档码里没有名字" };
  const skin = o.s|0;
  if (!(skin>=0 && skin<CHARS.length)) return { err:"存档码里的角色对不上，可能来自别的版本" };
  const pwd = typeof o.p==="string" ? o.p.slice(0,16) : "";
  const b2 = v => [0,1,2,3].map(i => String(v||"")[i]==="1");
  return { acc:{ name, skin, pwd, cleared:b2(o.c), spared:b2(o.r) } };
}
function wrapCode(s, n){
  const out = [];
  for (let i=0;i<s.length;i+=n) out.push(s.slice(i, i+n));
  return out;
}
function fallbackCopy(t){
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok){ setToast("存档码已复制", "#8ff0b8"); playSfx("snd_menu_select"); }
    else setToast("复制失败：手动选中框里的码", "#ff9cae");
  } catch(e){ setToast("复制失败：手动选中框里的码", "#ff9cae"); }
}
function copyText(t){
  try {
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(
        ()=>{ setToast("存档码已复制，去新电脑粘贴", "#8ff0b8"); playSfx("snd_menu_select"); },
        ()=>fallbackCopy(t));
      return;
    }
  } catch(e){}
  fallbackCopy(t);
}
function openSync(tab){
  g_inputMode = "";
  const names = Object.keys(loadAccounts());
  const fromLogin = (g_state===ST_LOGIN);
  g_sync = { tab: tab?1:0, who: g_accountKey || names[0] || "",
             code:"", err:"", over:"", ok:"",
             lock: fromLogin ? !!g_login.lock : false,
             prevUser: fromLogin ? (g_login.user||"") : "" };
  g_state = ST_SYNC; g_stateT = 0;
  Say(""); BgmStop(); crtDirty = true;
  if (g_sync.tab===1 && !isTouch) setTimeout(()=>focusInput(), 60);
}
function syncCycleWho(){
  const names = Object.keys(loadAccounts());
  if (names.length < 2) return;
  const i = names.indexOf(g_sync.who);
  g_sync.who = names[(i+1) % names.length];
  g_sync.err = ""; g_sync.ok = ""; g_sync.over = "";
  playSfx("snd_menu_move");
}
function doExportCopy(){
  const acc = loadAccounts()[g_sync.who];
  if (!acc){ g_sync.err = "这台电脑上没有可导出的存档"; playSfx("snd_menu_move"); return; }
  copyText(encodeSaveCode(acc));
}
function downloadSaveCode(){
  const acc = loadAccounts()[g_sync.who];
  if (!acc){ g_sync.err = "这台电脑上没有可导出的存档"; return; }
  try {
    const txt = "sanjiao 存档码\n存档：" + acc.name + "\n导出时间：" + new Date().toLocaleString() +
                "\n\n" + encodeSaveCode(acc) + "\n";
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([txt], {type:"text/plain;charset=utf-8"}));
    a.href = url; a.download = "sanjiao-" + (acc.name||"save") + ".txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    setToast("存档文件已下载", "#8ff0b8"); playSfx("snd_menu_select");
  } catch(e){ g_sync.err = "下载失败，用「复制存档码」"; }
}
function syncCheck(){                          // 一边粘贴一边校验，别等点了导入才报错
  if (!g_sync.code){ g_sync.err = ""; g_sync.ok = ""; return null; }
  const r = decodeSaveCode(g_sync.code);
  if (r.err){ g_sync.err = r.err; g_sync.ok = ""; return null; }
  const n = r.acc.cleared.filter(Boolean).length, sp = r.acc.spared.filter(Boolean).length;
  g_sync.err = "";
  g_sync.ok = `认出来了：${r.acc.name}（打赢 ${n} 个${sp ? " · 饶恕 " + sp + " 个" : ""}）`;
  return r.acc;
}
function doImportSave(){
  if (!g_sync.code){ g_sync.err = "先粘贴存档码"; playSfx("snd_menu_move"); return; }
  const r = decodeSaveCode(g_sync.code);
  if (r.err){ g_sync.err = r.err; g_sync.over = ""; playSfx("snd_menu_move"); return; }
  const acc = r.acc, accounts = loadAccounts();
  if (accounts[acc.name] && g_sync.over !== acc.name){   // 覆盖本机同名存档要按两次
    g_sync.over = acc.name;
    g_sync.err = `这台电脑已经有「${acc.name}」，再点一次「导入」就覆盖它`;
    playSfx("snd_menu_move"); return;
  }
  accounts[acc.name] = acc;
  saveAccounts(accounts);
  g_sync.over = "";
  applyAccount(acc.name);
  trustDevice(acc.name);
  hideInput(); g_inputMode = "";
  playSfx("snd_menu_select");
  setToast(`存档「${acc.name}」搬过来了`, "#8ff0b8");
  GoTitle();
}

function RenderSync(){
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2;
  const names = Object.keys(loadAccounts());
  outlineText("存 档 搬 运", 0, 20+VOY, 38, "#ffec78", cx);
  outlineText("存档只保存在这台电脑的浏览器里，换电脑不会自动同步", 0, 74+VOY, 13, "#9fb4e8", cx, false);

  // ---- 两个页签
  const tw = Math.min(210, (WINW-90)/2), ty = 106+VOY, th = 38;
  const tabs = ["导出到新电脑", "从旧电脑导入"];
  for (let i=0;i<2;++i){
    const tx = cx - tw - 8 + i*(tw+16);
    const on = g_sync.tab===i;
    ctx.fillStyle = on ? "rgba(78,60,120,0.95)" : "rgba(22,18,34,0.8)";
    ctx.strokeStyle = on ? "#ffe878" : "rgba(140,150,190,0.5)";
    ctx.lineWidth = on ? 2.5 : 1.5;
    roundRect(tx, ty, tw, th, 8); ctx.fill(); ctx.stroke();
    outlineText(tabs[i], 0, ty+9, 16, on ? "#fff3a8" : "#b9c2da", tx+tw/2, on);
    hot(tx-4, ty-4, tw+8, th+8, ()=>{ if (g_sync.tab!==i){ g_sync.tab=i; g_sync.err=""; g_sync.over="";
        playSfx("snd_menu_move"); if (i===1 && !isTouch) focusInput(); else hideInput(); } });
  }

  const bw = Math.min(540, WINW-70), bx = cx-bw/2;

  if (g_sync.tab===0){
    // ---- 导出：挑一个存档 → 显示存档码
    const acc = loadAccounts()[g_sync.who];
    const who = acc ? acc.name : "（这台电脑还没有存档）";
    outlineText(`存档：${who}${names.length>1 ? "　（点这里换一个）" : ""}`, bx, 158+VOY, 14,
                acc ? "#cfe0ff" : "#ff9cae", -1, false);
    if (names.length>1) hot(bx-6, 154+VOY, bw, 22, syncCycleWho);

    const code = acc ? encodeSaveCode(acc) : "";
    const boxY = 184+VOY, boxH = 116;
    ctx.fillStyle="rgba(12,10,24,0.9)"; ctx.fillRect(bx, boxY, bw, boxH);
    ctx.strokeStyle="rgba(140,160,220,0.6)"; ctx.lineWidth=1.5; ctx.strokeRect(bx, boxY, bw, boxH);
    if (code){
      const per = Math.max(24, Math.floor((bw-30)/7.2));   // 11px 粗体大约 7.2px 宽
      const lines = wrapCode(code, per).slice(0, 6);
      lines.forEach((ln,i)=>outlineText(ln, bx+12, boxY+10+i*17, 11, "#a8e8ff", -1, false));
    } else {
      outlineText("先建一个存档，再来导出", bx+14, boxY+44, 14, "#8a92b0", -1, false);
    }

    const byy = boxY+boxH+10;
    const w1 = 150, w2 = 132;
    if (acc){
      btn(bx, byy, w1, 36, "复 制", doExportCopy);
      roundRect(bx+w1+12, byy, w2, 36, 8);
      ctx.fillStyle="rgba(46,58,86,0.9)"; ctx.fill();
      ctx.strokeStyle="#7fa0d0"; ctx.lineWidth=2; ctx.stroke();
      outlineText("下载文件", 0, byy+9, 15, "#cfe0ff", bx+w1+12+w2/2);
      hot(bx+w1+6, byy-6, w2+12, 48, downloadSaveCode);
    }
    outlineText(isTouch ? "复制后发到新电脑：微信 / 备忘录 / 邮件都行"
                        : "复制后发到新电脑（聊天、邮件、备忘录都行）",
                bx, 356+VOY, 12, "#8fa0c8", -1, false);
    outlineText("新电脑上打开游戏 → 左上角「登录」→「搬运」→「从旧电脑导入」",
                bx, 376+VOY, 12, "#8fa0c8", -1, false);
    outlineText("这串码就是你的存档，别发给别人（谁拿到都能登）", bx, 396+VOY, 12, "#ffb0b0", -1, false);
  } else {
    // ---- 导入：粘贴 → 校验 → 导入
    const iy = 162+VOY, ih = 58;
    const shown = g_sync.code ? g_sync.code.slice(0, 30) + "…（" + g_sync.code.length + " 个字符）" : "";
    loginBox(bx, iy, bw, ih, true, shown, "在这里粘贴存档码（SJ1 开头）", false);
    placeInput("syncCode", g_sync.code, bx, iy, bw, ih, 600);
    hot(bx, iy, bw, ih, ()=>{ setInputMode("syncCode", g_sync.code, 600, true); focusInput(); });

    const msg = g_sync.err || g_sync.ok;
    if (msg) outlineText(msg, 0, iy+ih+8, 13, g_sync.err ? "#ff8a8a" : "#8ff0b8", cx, false);

    btn(cx-80, iy+ih+34, 160, 42, "导 入", doImportSave);

    outlineText(isTouch ? "点上面的框，长按粘贴" : "点上面的框，Ctrl+V 粘贴（整段粘，别删空格）",
                bx, iy+ih+92, 12, "#8fa0c8", -1, false);
    outlineText("导入后照常输用户名 + 原来那个密码登录", bx, iy+ih+112, 12, "#8fa0c8", -1, false);
    outlineText("存档码来自你自己信任的电脑：里面就是你的通关记录", bx, iy+ih+132, 12, "#8fa0c8", -1, false);
  }

  const hintY = Math.min(WINH-26, 430+VOY);        // 竖屏 VOY 会把内容推下去，别把提示甩到屏幕最底
  outlineText(isTouch ? "B 返回" : "B / ESC 返回　·　Tab 切换页签", 0, hintY, 12, "#8ea2d8", cx, false);
}

function RenderHostWarn(){
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2;
  outlineText("账号要换个链接", 0, 92+VOY, 36, "#ffec78", cx);
  outlineText("云账号只在游戏自己的 WorkBuddy 分享链接上能用", 0, 150+VOY, 14, "#9fb4e8", cx, false);
  outlineText("你现在的网址：" + (location.hostname||""), 0, 178+VOY, 12, "#7f92c4", cx, false);

  const bw = Math.min(430, WINW-70), bx = cx-bw/2, by = 210+VOY;
  btn(bx, by, bw, 56, "打开云账号版 →", ()=>{
    playSfx("snd_menu_select");
    location.href = CLOUD_URL;
  }, 20);
  outlineText("点一下跳过去，之后把它存成书签就行", 0, by+76, 12, "#8aa0cc", cx, false);

  const ca = currentAccount();
  if (ca){
    const ly = by+108;
    outlineText("先离线玩本机存档（不登账号）", 0, ly, 13, "#ffd257", cx, false);
    hot(cx-150, ly-6, 300, 24, ()=>{
      hideInput(); applyAccount(ca.user); playSfx("snd_menu_select"); Say(""); GoTitle();
      setToast("离线模式：这份进度只在这台电脑上", "#ffd257");
    });
  } else {
    outlineText("换台电脑登同一个邮箱就行，进度跟账号走", 0, by+108, 13, "#7f92c4", cx, false);
  }

  outlineText(isTouch ? "B 返回" : "B / ESC 返回", 0, 400+VOY, 12, "#8ea2d8", cx, false);
}

function RenderLogin(){
  // 非应用域名（如 GitHub Pages）：云账号必然被服务端拒绝，直接引导换链接，别让人对着报错猜网络
  if (!cloudHostOk()){ RenderHostWarn(); return; }
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2;
  const hostOk = cloudHostOk();
  outlineText("登　录", 0, 24+VOY, 44, "#ffec78", cx);
  outlineText(hostOk ? "账号就是邮箱：换哪台电脑登进来，存档都跟着你"
                     : "当前网址不支持云账号，请改用 WorkBuddy 分享链接",
              0, 82+VOY, 14, hostOk ? "#9fb4e8" : "#ffd257", cx, false);

  const bw = Math.min(430, WINW-70), bx = cx-bw/2, bh = 56;
  const uy = 110+VOY, py = 180+VOY;
  const email = (nameIn && g_inputMode==="loginUser") ? nameIn.value : g_login.user;
  const pwd   = (nameIn && g_inputMode==="loginPwd")  ? nameIn.value : g_login.pwd;
  loginBox(bx, uy, bw, bh, g_login.sel===0, email, "邮箱", false);
  loginBox(bx, py, bw, bh, g_login.sel===1, pwd, "密码", true);
  if (g_login.sel===0) placeInput("loginUser", g_login.user, bx, uy, bw, bh, 64);
  else                 placeInput("loginPwd",  g_login.pwd,  bx, py, bw, bh, 32);
  hot(bx, uy, bw, bh, ()=>{ g_login.sel=0; setInputMode("loginUser", g_login.user, 64, true); focusInput(); });
  hot(bx, py, bw, bh, ()=>{ g_login.sel=1; setInputMode("loginPwd",  g_login.pwd,  32, true); focusInput(); });

  const c = cloudClient();
  const msg = g_login.err || g_login.ok || (c ? "" : (window.__cloudFail ? "云账号组件加载失败：点下面小字重试" : "正在连接云账号服务…"));
  if (msg) outlineText(msg, 0, 248+VOY, 13,
                       g_login.err ? "#ff8a8a" : (g_login.ok ? "#8ff0b8" : "#ffd257"), cx, false);
  if (!c) hot(cx-190, 242+VOY, 380, 20, ()=>{ if (window.__cloudRetry) window.__cloudRetry(); });

  const by = 272+VOY, bwd = Math.min(150, (WINW-90)/2), gap = 22;
  const bx0 = cx - (bwd*2+gap)/2;
  btn(bx0,           by, bwd, 46, "登　录", ()=>{ doLogin(); }, 19);
  btn(bx0+bwd+gap,   by, bwd, 46, "注　册", ()=>{ playSfx("snd_menu_select"); newAccountFromLogin(); }, 19);

  // ---- 三个小字入口：忘记密码 / 离线进入 / 退出账号
  const ly = 334+VOY;
  const ca = currentAccount();
  const fx = ca ? cx-140 : cx;
  outlineText("忘记密码", 0, ly, 13, "#8fb6ff", fx, false);
  hot(fx-40, ly-6, 96, 22, ()=>{ playSfx("snd_menu_move"); openSignup("reset"); });
  if (ca){
    outlineText("离线进入本机存档", 0, ly, 13, "#ffd257", cx+14, false);
    hot(cx-64, ly-6, 156, 22, ()=>{
      hideInput(); applyAccount(ca.user); playSfx("snd_menu_select"); Say(""); GoTitle();
      setToast("离线模式：这份进度只在这台电脑上", "#ffd257");
    });
  }
  if (g_cloud.uid){
    outlineText("退出账号", 0, ly+22, 12, "#8a92b0", cx, false);
    hot(cx-40, ly+16, 80, 20, ()=>{ cloudLogout(); });
    outlineText(`当前云端账号：${g_cloud.email || g_cloud.uid}`, 0, ly+42, 11, "#7f92c4", cx, false);
  }

  outlineText(isTouch ? "B 返回" : "B / ESC 返回　·　X 返回", 0, 400+VOY, 12, "#8ea2d8", cx, false);
  if (!g_cloud.uid && !ca)
    outlineText("第一次来先点「注册」：邮箱收一次验证码就好", 0, 422+VOY, 12, "#7f92c4", cx, false);
  else if (!g_cloud.uid && ca)
    outlineText("云端存档在哪台电脑都能登；离线进入只玩本机这份", 0, 422+VOY, 11, "#7f92c4", cx, false);
}

function RenderSignup(){
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2, reset = g_su.mode==="reset";
  outlineText(reset ? "重 设 密 码" : "注　册", 0, 10+VOY, 38, "#ffec78", cx);
  outlineText(reset ? "邮箱收验证码 → 直接设新密码" : "一个邮箱一个账号；注册完换电脑输邮箱 + 密码就能进",
              0, 56+VOY, 13, "#9fb4e8", cx, false);

  const bw = Math.min(430, WINW-70), bx = cx-bw/2, bh = 46;
  const ey = 92+VOY, cy2 = 162+VOY, py2 = 232+VOY;
  const email = (nameIn && g_inputMode==="suEmail") ? nameIn.value : g_su.email;
  const code  = (nameIn && g_inputMode==="suCode")  ? nameIn.value : g_su.code;
  const pwd   = (nameIn && g_inputMode==="suPwd")   ? nameIn.value : g_su.pwd;

  outlineText("邮箱", bx, ey-16, 12, "#b4d2ff", -1, false);
  const btnW = Math.min(126, bw*0.34);
  loginBox(bx, ey, bw-btnW-8, bh, g_su.sel===0, email, "你的邮箱", false);
  const cool = suCoolLeft();
  roundRect(bx+bw-btnW, ey, btnW, bh, 8);
  ctx.fillStyle = cool>0 ? "rgba(34,38,56,0.9)" : "rgba(46,58,96,0.92)"; ctx.fill();
  ctx.strokeStyle = cool>0 ? "#5a6688" : "#7fa0d0"; ctx.lineWidth = 2; ctx.stroke();
  outlineText(cool>0 ? cool+"s 后重发" : "发送验证码", 0, ey+bh/2-9, 13,
              cool>0 ? "#8a92b0" : "#cfe0ff", bx+bw-btnW/2, false);
  hot(bx+bw-btnW, ey, btnW, bh, ()=>{ suSendCode(); });

  outlineText("验证码", bx, cy2-16, 12, "#b4d2ff", -1, false);
  loginBox(bx, cy2, bw, bh, g_su.sel===1, code, "邮箱里收到的 6 位数字", false);

  outlineText(reset ? "新密码（至少 6 位）" : "密码（至少 6 位，别忘，就靠它登录）", bx, py2-16, 12, "#b4d2ff", -1, false);
  loginBox(bx, py2, bw, bh, g_su.sel===2, pwd, "自己设一个", true);

  if (g_su.sel===0)      placeInput("suEmail", g_su.email, bx, ey,  bw-btnW-8, bh, 64);
  else if (g_su.sel===1) placeInput("suCode",  g_su.code,  bx, cy2, bw, bh, 8);
  else                   placeInput("suPwd",   g_su.pwd,   bx, py2, bw, bh, 32);
  hot(bx, ey, bw-btnW-8, bh, ()=>{ g_su.sel=0; setInputMode("suEmail", g_su.email, 64, true); focusInput(); });
  hot(bx, cy2, bw, bh, ()=>{ g_su.sel=1; setInputMode("suCode", g_su.code, 8, true); focusInput(); });
  hot(bx, py2, bw, bh, ()=>{ g_su.sel=2; setInputMode("suPwd", g_su.pwd, 32, true); focusInput(); });

  const msg = g_su.err || g_su.ok;
  if (msg) outlineText(msg, 0, 290+VOY, 12, g_su.err ? "#ff8a8a" : "#8ff0b8", cx, false);

  const bwd = Math.min(170, (WINW-90)/2);
  btn(cx-bwd-10, 310+VOY, bwd, 44, reset ? "改 好 了" : "注 册 并 进 入", ()=>{ suSubmit(); }, 17);
  btn(cx+10,     310+VOY, Math.min(96, bwd), 44, "返 回", ()=>{
    hideInput(); playSfx("snd_menu_move"); openLogin(g_su.email, false);
  }, 16);

  outlineText(isTouch ? "点输入框打字" : "Tab 换栏位　Enter 提交", 0, 368+VOY, 12, "#8ea2d8", cx, false);
  outlineText("验证码 5 分钟有效；没收到就看垃圾箱，或再发一次", 0, 390+VOY, 11, "#7f92c4", cx, false);
}

function RenderSetPwd(){
  const bg0 = img("bg");
  if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
  else { ctx.fillStyle="rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH); }
  const cx = WINW/2;
  const acc = loadAccounts()[g_accountKey];
  outlineText("给 存 档 设 密 码", 0, 26+VOY, 42, "#ffec78", cx);
  outlineText(`存档：${(acc && acc.name) || g_accountKey || "—"}　（设好后每次进入都要输它）`,
              0, 84+VOY, 14, "#9fb4e8", cx, false);

  const bw = Math.min(420, WINW-80), bx = cx-bw/2, bh = 58;
  const py1 = 126+VOY, py2 = 224+VOY;
  const p1 = (nameIn && g_inputMode==="setPwd")  ? nameIn.value : g_setpwd.pwd;
  const p2 = (nameIn && g_inputMode==="setPwd2") ? nameIn.value : g_setpwd.pwd2;
  outlineText("新密码（至少 4 位，最多 16）", bx, py1-26, 13, "#b4d2ff", -1, false);
  loginBox(bx, py1, bw, bh, g_setpwd.sel===0, p1, "新密码", true);
  outlineText("再输一次", bx, py2-26, 13, "#b4d2ff", -1, false);
  loginBox(bx, py2, bw, bh, g_setpwd.sel===1, p2, "确认密码", true);

  if (g_setpwd.sel===0) placeInput("setPwd",  p1, bx, py1, bw, bh, 16);
  else                  placeInput("setPwd2", p2, bx, py2, bw, bh, 16);

  hot(bx, py1, bw, bh, ()=>{ g_setpwd.sel=0; setInputMode("setPwd",  g_setpwd.pwd,  16, true); focusInput(); });
  hot(bx, py2, bw, bh, ()=>{ g_setpwd.sel=1; setInputMode("setPwd2", g_setpwd.pwd2, 16, true); focusInput(); });

  const msg = g_setpwd.err || g_setpwd.ok;
  if (msg) outlineText(msg, 0, 294+VOY, 15, g_setpwd.err?"#ff8a8a":"#8ff0b8", cx, false);

  const bwd = Math.min(180, (WINW-100)/2), gap = 24;
  btn(cx-bwd-gap/2, 324+VOY, bwd, 44, "保 存", ()=>{ playSfx("snd_menu_select"); doSetPwd(); });
  btn(cx+gap/2, 324+VOY, bwd, 44, "返 回", ()=>{ playSfx("snd_menu_move"); hideInput(); GoTitle(); });

  outlineText("密码只存在这台设备上，忘了就进不去（可以新建存档重来）", 0, 388+VOY, 12, "#8ea2d8", cx, false);
  outlineText(isTouch?"↑ ↓ 切换　A 保存":"↑ ↓ 切换　Z / Enter 保存　ESC 返回", 0, 412+VOY, 13, "#b4d2ff", cx, false);
}



// ---------------- 我的房间：格子 / 背包 / 家具 ----------------
const ROOM_KEY = "sanjiao_room_v1";
const BAG_SLOT = 52, BAG_GAP = 8;                                   // 背包格子最大边长 / 间距
function furnDef(kind){ for (const f of FURN) if (f.kind===kind) return f; return FURN[0]; }
function roomCols(){ return Math.max(6, Math.floor(WINW/TILE)); }
function roomRows(){ return Math.max(4, Math.floor((roomBagBand().y - 8 - ROOM_WALL_Y)/TILE)); }
function roomFloorTop(){ return ROOM_WALL_Y + 30; }                 // 脚底最上沿（头可以探进墙里）
function roomFloorBot(){ return ROOM_WALL_Y + roomRows()*TILE - 6; } // 脚底最下沿（不钻进背包栏）
function bagWantW(){ return FURN.length*BAG_SLOT + 22 + BAG_GAP*(FURN.length-1); }  // 家具变多了，栏也跟着变长
function roomBagBand(){                                             // 背包栏的位置（要躲开虚拟按键）
  if (PAD.on && PAD.a && PAD.b && PAD.right && PAD.up){
    const gl = PAD.right.x + PAD.right.w + 10;                      // 左组方向键右边
    const gr = Math.min(PAD.a.x-PAD.a.r, PAD.b.x-PAD.b.r) - 10;     // 右边 A/B 的左边
    if (gr-gl >= 220){                                             // 横屏：刚好夹在两组按键中间
      const w = Math.min(gr-gl, Math.max(240, bagWantW()));
      return { x: gl + ((gr-gl)-w)/2, y: WINH-SAFE_B-BAG_H-6, w, h:BAG_H };
    }
    const w = Math.min(WINW-16, Math.max(268, bagWantW()));         // 竖屏：抬到方向键上方，横跨整屏
    const vTop = Math.min(PAD.up.y, PAD.left.y) - 12;
    return { x:(WINW-w)/2, y: Math.max(ROOM_WALL_Y+56, vTop-BAG_H), w, h:BAG_H };
  }
  const w = Math.min(WINW-20, Math.max(240, bagWantW()));           // 键鼠：底部居中
  return { x:(WINW-w)/2, y: WINH-SAFE_B-BAG_H-6, w, h:BAG_H };
}
function furnSpan(kind, rot){ const d=furnDef(kind); return rot ? {w:d.h, h:d.w} : {w:d.w, h:d.h}; }
function furnPx(gx, gy, kind, rot){                                 // 格子坐标 → 像素矩形
  const sp = furnSpan(kind, rot);
  return { x:gx*TILE, y:ROOM_WALL_Y+gy*TILE, w:sp.w*TILE, h:sp.h*TILE };
}
// ---- 桌上的东西：桌子只是一块台面，电视机的格子落在桌子范围里就算"摆上去" ----
function furnSupportOf(it){                                         // 这件家具底下托着它的桌子（没有就返回 null）
  if (!it || !it.on) return null;
  const sp = furnSpan(it.kind, it.rot);
  for (const t of g_roomFurn){
    if (t===it) continue;
    const td = furnDef(t.kind);
    if (!td.surface || t.rot) continue;                             // 转过 90° 的桌子视角不对，当不了台面
    const ts = furnSpan(t.kind, t.rot);
    if (it.gx>=t.gx && it.gy>=t.gy && it.gx+sp.w<=t.gx+ts.w && it.gy+sp.h<=t.gy+ts.h) return t;
  }
  return null;
}
function furnTopY(r){ return r.y + r.h*0.46; }                      // 桌面（前沿）在像素矩形里的高度
function furnDrawRect(it){                                          // 真正画出来的矩形：在桌上的会缩小并抬到桌面
  const base = furnPx(it.gx, it.gy, it.kind, it.rot);
  if (!it.on) return base;
  const sup = furnSupportOf(it); if (!sup) return base;
  const sr = furnPx(sup.gx, sup.gy, sup.kind, sup.rot);
  const sp = furnSpan(it.kind, it.rot);
  const im = img(furnDef(it.kind).img);
  const ar = (im && im.naturalWidth) ? im.naturalWidth/im.naturalHeight : 2;
  let w = Math.min(sp.w*TILE*1.05, sr.w*0.62), h = w/ar;            // 别超过桌面宽度的六成
  const maxH = sr.h*0.60;                                           // 也别比桌面本身还高太多
  if (h>maxH){ h=maxH; w=h*ar; }
  const x = clamp(sr.x + (it.gx - sup.gx)*TILE + (sp.w*TILE - w)/2, sr.x, sr.x+sr.w-w);  // 按摆的第几格对齐，别探出桌面
  return { x, y: furnTopY(sr) - h, w, h };
}
function furnHitRect(it){                                           // 点选判定：桌面上的东西只认画出来的那块
  const b = furnPx(it.gx, it.gy, it.kind, it.rot);
  if (!it.on) return b;
  return furnDrawRect(it);
}
function tableUnder(x, y){                                          // 指针下面有没有能摆东西的桌面
  for (let i=g_roomFurn.length-1; i>=0; --i){
    const t = g_roomFurn[i];
    if (!furnDef(t.kind).surface || t.rot) continue;
    const r = furnPx(t.gx, t.gy, t.kind, t.rot);
    if (x>=r.x && x<r.x+r.w && y>=r.y-10 && y<r.y+r.h) return t;
  }
  return null;
}
function rectsHit(a,b){ return a.x1>b.x0 && a.x0<b.x1 && a.y1>b.y0 && a.y0<b.y1; }
function roomCharBox(x,y){ return { x0:x-13, x1:x+13, y0:y-26, y1:y-2 }; }   // 角色脚下的碰撞盒
function roomBlocked(x,y){                                          // 角色会不会撞到家具
  const b = roomCharBox(x,y);
  for (const it of g_roomFurn){
    const r = furnPx(it.gx, it.gy, it.kind, it.rot);
    if (rectsHit(b, {x0:r.x, y0:r.y, x1:r.x+r.w, y1:r.y+r.h})) return true;
  }
  return false;
}
function furnFree(gx, gy, kind, rot, support){                      // 这个位置能不能放
  const sp = furnSpan(kind, rot);
  if (gx<0 || gy<0 || gx+sp.w>roomCols() || gy+sp.h>roomRows()) return false;
  const r = { x0:gx*TILE, y0:ROOM_WALL_Y+gy*TILE, x1:(gx+sp.w)*TILE, y1:ROOM_WALL_Y+(gy+sp.h)*TILE };
  for (const it of g_roomFurn){
    if (support && it===support) continue;                          // 摆在桌上：桌子本身不算挡路
    const q = furnPx(it.gx, it.gy, it.kind, it.rot);
    if (rectsHit(r, {x0:q.x, y0:q.y, x1:q.x+q.w, y1:q.y+q.h})) return false;
  }
  if (support) return true;                                         // 桌上的东西不占地面，不用管角色站位
  return !rectsHit(r, roomCharBox(g_room.x, g_room.y));
}
function holdTiles(){                                               // 手上家具要占的格子（吸附到网格）
  if (!g_hold) return null;
  const d = furnDef(g_hold.kind), sp = furnSpan(g_hold.kind, g_hold.rot);
  let gx = Math.round(g_mouse.x/TILE - sp.w/2);
  let gy = Math.round((g_mouse.y-ROOM_WALL_Y)/TILE - sp.h/2);
  if (d.stack && !g_hold.rot){                                      // 能上桌的：指针压在桌子上就吸附到桌面
    const t = tableUnder(g_mouse.x, g_mouse.y);
    if (t){
      const ts = furnSpan(t.kind, t.rot);
      if (sp.w<=ts.w && sp.h<=ts.h){
        gx = clamp(gx, t.gx, t.gx+ts.w-sp.w);
        gy = clamp(gy, t.gy, t.gy+ts.h-sp.h);
        return { gx, gy, w:sp.w, h:sp.h, on:t };
      }
    }
  }
  gx = clamp(gx, 0, Math.max(0, roomCols()-sp.w));
  gy = clamp(gy, 0, Math.max(0, roomRows()-sp.h));
  return { gx, gy, w:sp.w, h:sp.h, on:null };
}
function roomBagSlots(){
  const b = roomBagBand(), n = FURN.length, gap = BAG_GAP;
  const sw = Math.min(BAG_SLOT, (b.w - 22 - gap*(n-1))/n);
  const total = n*sw + gap*(n-1);
  const x0 = b.x + (b.w-total)/2, y0 = b.y + (b.h-sw)/2;
  return FURN.map((f,i)=>({ f, i, x:x0+i*(sw+gap), y:y0, w:sw, h:sw }));
}
function roomHold(i){                                               // 点背包格：拿到手上 / 再点一次旋转
  const f = FURN[i]; if (!f) return;
  if (g_hold && g_hold.kind===f.kind){
    if (f.clear){ DropHold(); return; }                           // 再点一次清除：放回背包
    RotateHold(); return;
  }
  g_hold = { kind:f.kind, rot:0 };
  playSfx("snd_menu_select");
  if (f.clear) setToast("点房间里的家具把它拆掉", "#ffd0a0");
}
function RotateHold(){
  if (!g_hold || furnDef(g_hold.kind).clear) return;              // 清除工具不旋转
  g_hold.rot = g_hold.rot?0:1;
  playSfx("snd_menu_move");
}
function furnAt(x, y){                                            // 指针下面有没有家具
  for (let i=g_roomFurn.length-1; i>=0; --i){
    const it = g_roomFurn[i];
    const r = furnHitRect(it);
    if (x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h) return i;
  }
  return -1;
}
function ClearAt(x, y){
  const i = furnAt(x, y);
  if (i < 0){ setToast("这里没有家具", "#c9d4e8"); playSfx("snd_menu_move"); return; }
  const it = g_roomFurn[i];
  const names = [furnDef(it.kind).name];
  g_roomFurn.splice(i, 1);
  for (let j=g_roomFurn.length-1; j>=0; --j){                     // 桌子被拆：桌上的东西一起收走，免得悬空
    const o = g_roomFurn[j];
    if (o.on && !furnSupportOf(o)){ names.push(furnDef(o.kind).name); g_roomFurn.splice(j, 1); }
  }
  saveRoom(); playSfx("snd_menu_select");
  setToast(`${names.join(" 和 ")} 拆掉了`, "#a8f0c0");
}
function DropHold(){ if (!g_hold) return; g_hold=null; playSfx("snd_menu_move"); setToast("收进背包了", "#cfe0ff"); }

// ---- 能开关的家具（空调 / 台灯）：走近按 E 互动 ----
const REACH = 54;                                                  // 够得着的距离（像素，从家具边缘算）
function furnReachRect(it){                                        // 桌上的东西按"桌子"算距离：走到桌边就能按
  const sup = it.on ? furnSupportOf(it) : null;
  return furnPx((sup||it).gx, (sup||it).gy, (sup||it).kind, (sup||it).rot);
}
function interTarget(){                                            // 角色旁边最近的一件可互动家具
  let best=null, bd=1e9;
  for (const it of g_roomFurn){
    if (!furnDef(it.kind).sw) continue;
    const r = furnReachRect(it);
    const dx = Math.max(r.x-g_room.x, 0, g_room.x-(r.x+r.w));
    const dy = Math.max(r.y-g_room.y, 0, g_room.y-(r.y+r.h));
    const d = Math.hypot(dx, dy);
    if (d<=REACH && d<bd){ bd=d; best=it; }
  }
  return best;
}
function ToggleFurn(it){
  if (!it) return;
  it.sw = it.sw ? 0 : 1;                                          // 1 = 开着，0 = 关着
  saveRoom();
  playSfx(it.sw ? "snd_menu_select" : "snd_menu_move");
  setToast(`${furnDef(it.kind).name} ${it.sw?"打开了":"关掉了"}`,
           it.sw ? "#ffe6a0" : "#c9d4e8");
}
function InteractRoom(){                                           // E：开 / 关身边那件家具
  const it = interTarget();
  if (!it){ setToast("旁边没有能按的东西", "#c9d4e8"); playSfx("snd_menu_move"); return; }
  ToggleFurn(it);
}
function PlaceHold(){
  if (!g_hold) return;
  const d = furnDef(g_hold.kind);
  if (d.clear){ ClearAt(g_mouse.x, g_mouse.y); return; }          // 清除工具：拆家具
  const t = holdTiles(); if (!t) return;
  if (!furnFree(t.gx, t.gy, g_hold.kind, g_hold.rot, t.on)){
    setToast(t.on ? "桌上摆不开了：先把桌上的东西挪走" : "这里放不下：格子撞上了", "#ff9cae");
    playSfx("snd_menu_move"); return;
  }
  const it = { kind:g_hold.kind, gx:t.gx, gy:t.gy, rot:g_hold.rot };
  if (t.on) it.on = 1;                                            // 标记：摆在桌子上
  if (d.sw) it.sw = 0;                                            // 能开关的家具：摆下去默认关着
  g_roomFurn.push(it);
  saveRoom(); playSfx("snd_menu_select");
  setToast(t.on ? `${d.name} 放到桌子上了` : `${d.name} 放好了`, "#a8f0c0");
}
function loadRoom(){
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem(ROOM_KEY) || "[]"); }catch(e){ arr = []; }
  g_roomFurn = (Array.isArray(arr) ? arr : [])
    .filter(it => it && FURN.some(f=>f.kind===it.kind && !f.clear))
    .map(it => {
      const o = { kind:it.kind, gx:it.gx|0, gy:it.gy|0, rot:it.rot?1:0 };
      if (it.on) o.on = 1;
      if (furnDef(it.kind).sw) o.sw = it.sw?1:0;                  // 开关状态跟着存档走
      return o;
    })
    .filter(it => it.gx>=0 && it.gy>=0);
  g_roomFurn = g_roomFurn.filter(it => !it.on || !!furnSupportOf(it));   // 桌子没了的悬空家具直接不要
  // 旧存档整理：家具格子改过（沙发 8→10 格），越界或互相压住的就丢掉
  // 判优先级：沙发先让路，别把玩家后摆的桌子/电视挤掉
  const order = g_roomFurn.map((it,i)=>({ it, i }))
    .sort((a,b)=> ((a.it.kind==="sofa"?1:0)-(b.it.kind==="sofa"?1:0)) || (a.i-b.i));
  const keep = [];
  for (const { it } of order){
    const sp = furnSpan(it.kind, it.rot);
    if (it.gx+sp.w>roomCols() || it.gy+sp.h>roomRows()) continue;
    const r = furnPx(it.gx, it.gy, it.kind, it.rot);
    const sup = it.on ? furnSupportOf(it) : null;
    let bad = false;
    for (const k of keep){
      if (sup && k===sup) continue;
      const q = furnPx(k.gx, k.gy, k.kind, k.rot);
      if (rectsHit({x0:r.x,y0:r.y,x1:r.x+r.w,y1:r.y+r.h},
                   {x0:q.x,y0:q.y,x1:q.x+q.w,y1:q.y+q.h})){ bad=true; break; }
    }
    if (!bad) keep.push(it);
  }
  g_roomFurn = g_roomFurn.filter(it => keep.indexOf(it) >= 0);        // 保持原来的摆放顺序
}
function saveRoom(){
  try{ localStorage.setItem(ROOM_KEY, JSON.stringify(g_roomFurn)); }catch(e){}
  if (g_cloud.uid) cloudPushSoon();                 // 家具也存进云端，换电脑房间还在
}

// ---- 家具图形（在给定矩形里画，尺寸自适应；rot 时整体转 90°） ----
function artTable(x,y,w,h,plain){
  const pad = Math.max(2, w*0.025);
  ctx.fillStyle="rgba(40,24,10,0.15)";                          // 影子
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h*0.95, w*0.44, h*0.05, 0,0,6.29); ctx.fill();
  const lw=Math.max(4,w*0.075);                                 // 四条腿（后两条靠内、颜色更深）
  ctx.fillStyle="#65401c";
  ctx.fillRect(x+w*0.20, y+h*0.56, lw*0.75, h*0.34);
  ctx.fillRect(x+w*0.80-lw*0.75, y+h*0.56, lw*0.75, h*0.34);
  ctx.fillStyle="#7b4d22";
  ctx.fillRect(x+w*0.11, y+h*0.52, lw, h*0.43);
  ctx.fillRect(x+w*0.89-lw, y+h*0.52, lw, h*0.43);
  const ty=y+h*0.10, th=h*0.40;                                 // 桌面：前缘厚度 + 上表面
  roundRect(x+pad, ty+th*0.72, w-pad*2, th*0.50, 6);
  ctx.fillStyle="#8a5624"; ctx.fill();
  roundRect(x+pad, ty, w-pad*2, th, 6);
  ctx.fillStyle="#d7a163"; ctx.fill();
  ctx.strokeStyle="rgba(84,48,18,0.9)"; ctx.lineWidth=Math.max(1.6,w*0.013); ctx.stroke();
  ctx.save();                                                   // 木纹 + 高光
  roundRect(x+pad, ty, w-pad*2, th, 6); ctx.clip();
  ctx.fillStyle="rgba(255,240,210,0.42)";
  roundRect(x+pad+3, ty+3, w-pad*2-6, th*0.34, 4); ctx.fill();
  ctx.strokeStyle="rgba(120,74,30,0.28)"; ctx.lineWidth=1;
  for (let i=1;i<=3;i++){ const yy=ty+th*(0.42+0.16*i);
    ctx.beginPath(); ctx.moveTo(x+pad*1.6,yy); ctx.lineTo(x+w-pad*1.6,yy); ctx.stroke(); }
  if (plain) { ctx.restore(); return; }                        // 旋转后不放杯碟
  const pcx=x+w*0.33, pcy=ty+th*0.58, pr=Math.min(w*0.11, th*0.30);
  ctx.fillStyle="rgba(60,36,14,0.20)";
  ctx.beginPath(); ctx.ellipse(pcx, pcy+pr*0.42, pr*1.15, pr*0.52, 0,0,6.29); ctx.fill();
  ctx.fillStyle="#f4efe2"; ctx.beginPath(); ctx.ellipse(pcx, pcy, pr*1.15, pr*0.62, 0,0,6.29); ctx.fill();
  ctx.strokeStyle="rgba(150,132,110,0.55)"; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle="#e3dccb"; ctx.beginPath(); ctx.ellipse(pcx, pcy, pr*0.66, pr*0.34, 0,0,6.29); ctx.fill();
  const mcx=x+w*0.58, mcy=ty+th*0.52, mw=pr*0.98, mh=pr*1.30;
  ctx.fillStyle="#d8e4ee";
  roundRect(mcx-mw/2, mcy-mh*0.5, mw, mh, Math.max(2,mw*0.28)); ctx.fill();
  ctx.strokeStyle="rgba(120,136,152,0.7)"; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.arc(mcx+mw*0.62, mcy, mw*0.30, -1.2, 1.2); ctx.stroke();
  ctx.restore();
}
function artTv(x,y,w,h){
  ctx.fillStyle="rgba(40,24,10,0.15)";
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h*0.96, w*0.42, h*0.045, 0,0,6.29); ctx.fill();
  ctx.strokeStyle="#8d95a3"; ctx.lineWidth=Math.max(2,w*0.016);  // 天线
  ctx.beginPath(); ctx.moveTo(x+w*0.36, y+h*0.14); ctx.lineTo(x+w*0.20, y+h*0.01); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+w*0.54, y+h*0.14); ctx.lineTo(x+w*0.68, y+h*0.01); ctx.stroke();
  ctx.fillStyle="#cfd6e0";
  ctx.beginPath(); ctx.arc(x+w*0.20, y+h*0.01, Math.max(1.6,w*0.014),0,6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(x+w*0.68, y+h*0.01, Math.max(1.6,w*0.014),0,6.29); ctx.fill();
  ctx.fillStyle="#3b414b";                                       // 底座
  ctx.fillRect(x+w*0.42, y+h*0.70, w*0.16, h*0.16);
  ctx.fillRect(x+w*0.30, y+h*0.86, w*0.40, h*0.07);
  const bx=x+w*0.03, by=y+h*0.13, bw=w*0.94, bh=h*0.60;          // 机身（CRT：上面略窄）
  ctx.beginPath();
  ctx.moveTo(bx+bw*0.06, by); ctx.lineTo(bx+bw*0.94, by);
  ctx.lineTo(bx+bw, by+bh*0.55); ctx.lineTo(bx+bw, by+bh);
  ctx.lineTo(bx, by+bh); ctx.lineTo(bx, by+bh*0.55); ctx.closePath();
  ctx.fillStyle="#333944"; ctx.fill();
  ctx.strokeStyle="#191c22"; ctx.lineWidth=Math.max(1.6,w*0.016); ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,0.10)";                        // 机身高光
  ctx.fillRect(bx+bw*0.06, by+1, bw*0.88, Math.max(2,h*0.03));
  const sx=bx+bw*0.06, sy=by+bh*0.12, sw=bw*0.68, sh=bh*0.74;    // 屏幕
  roundRect(sx,sy,sw,sh,Math.max(3,w*0.030));
  const sg=ctx.createLinearGradient(sx,sy,sx+sw,sy+sh);
  sg.addColorStop(0,"#8ddcf5"); sg.addColorStop(0.55,"#3f9ec0"); sg.addColorStop(1,"#1d5069");
  ctx.fillStyle=sg; ctx.fill();
  ctx.strokeStyle="rgba(10,16,22,0.6)"; ctx.lineWidth=Math.max(1.4,w*0.014); ctx.stroke();
  ctx.save(); ctx.beginPath(); roundRect(sx,sy,sw,sh,Math.max(3,w*0.030)); ctx.clip();
  ctx.fillStyle="rgba(255,255,255,0.08)";
  for (let yy=sy+3; yy<sy+sh; yy+=4) ctx.fillRect(sx, yy, sw, 1.5);   // 扫描线
  ctx.fillStyle="rgba(255,255,255,0.15)";                             // 反光
  ctx.beginPath(); ctx.moveTo(sx+sw*0.06,sy+sh); ctx.lineTo(sx+sw*0.38,sy);
  ctx.lineTo(sx+sw*0.54,sy); ctx.lineTo(sx+sw*0.22,sy+sh); ctx.closePath(); ctx.fill();
  ctx.restore();
  const px=bx+bw*0.80, pw=bw*0.16;                              // 右侧控制面板
  ctx.fillStyle="#232830"; ctx.fillRect(px, by+bh*0.14, pw, bh*0.72);
  ctx.fillStyle="#cfd6e0";
  ctx.beginPath(); ctx.arc(px+pw/2, by+bh*0.30, Math.max(2,w*0.021),0,6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(px+pw/2, by+bh*0.52, Math.max(2,w*0.021),0,6.29); ctx.fill();
  ctx.fillStyle="rgba(140,150,165,0.85)";                        // 喇叭格栅
  for (let i=0;i<3;i++) ctx.fillRect(px+pw*0.22, by+bh*(0.66+i*0.06), pw*0.56, 1.6);
}
function artSofa(x,y,w,h){
  const col="#b4575e", dark="#7e343a", light="#d4777d";
  ctx.fillStyle="rgba(40,24,10,0.16)";
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h*0.96, w*0.44, h*0.05, 0,0,6.29); ctx.fill();
  ctx.fillStyle="#4a2a1c";                                     // 沙发脚
  ctx.fillRect(x+w*0.08, y+h*0.88, w*0.05, h*0.08);
  ctx.fillRect(x+w*0.87, y+h*0.88, w*0.05, h*0.08);
  roundRect(x+w*0.05, y+h*0.08, w*0.90, h*0.42, Math.max(6,h*0.13));   // 靠背
  ctx.fillStyle=dark; ctx.fill();
  roundRect(x+w*0.08, y+h*0.11, w*0.84, h*0.33, Math.max(5,h*0.10));
  ctx.fillStyle=col; ctx.fill();
  const sy=y+h*0.46, sh=h*0.42;                                // 坐垫
  roundRect(x+w*0.09, sy, w*0.82, sh, Math.max(5,h*0.11));
  ctx.fillStyle=light; ctx.fill();
  ctx.strokeStyle="rgba(96,34,38,0.55)"; ctx.lineWidth=Math.max(1.2,w*0.008); ctx.stroke();
  ctx.strokeStyle="rgba(120,52,56,0.50)"; ctx.lineWidth=Math.max(1,w*0.006);
  ctx.beginPath(); ctx.moveTo(x+w*0.5, sy+2); ctx.lineTo(x+w*0.5, sy+sh-2); ctx.stroke();
  for (const ax of [x+w*0.015, x+w*0.90]){                     // 扶手
    roundRect(ax, y+h*0.30, w*0.085, h*0.62, Math.max(4,w*0.028));
    ctx.fillStyle=col; ctx.fill();
    ctx.strokeStyle="rgba(80,28,32,0.6)"; ctx.lineWidth=Math.max(1,w*0.007); ctx.stroke();
  }
}
function drawFurn(kind, x, y, w, h, rot, alpha, onTop){
  const d = furnDef(kind), im = img(d.img);
  if (alpha!=null){ ctx.save(); ctx.globalAlpha = alpha; }
  if (im){
    ctx.save();
    ctx.imageSmoothingEnabled = false;                          // 像素图：最近邻，不糊
    if (onTop){                                                 // 摆在桌面上：影子落在桌面，不落地上
      ctx.fillStyle="rgba(46,26,10,0.22)";
      ctx.beginPath(); ctx.ellipse(x+w/2, y+h-1.5, w*0.42, 3, 0, 0, 6.29); ctx.fill();
      ctx.drawImage(im, x, y, w, h);
    } else if (rot){                                            // 竖着摆：不旋转图像，等比缩放后贴地站好（像素不拉伸）
      const ar = im.naturalWidth / im.naturalHeight;
      let dw = w, dh = Math.min(h-4, (w/ar)*2);                 // 纵深压一半：看得清"转过去了"，又不至于被拉长
      if (dh > h-4){ dh = h-4; dw = dh*ar; }
      const dx = x + (w-dw)/2, dy = y + h - dh;
      ctx.fillStyle="rgba(52,30,10,0.17)";                      // 脚下影子：看着是"站着"不是躺着
      ctx.beginPath(); ctx.ellipse(x+w/2, y+h-2, dw*0.40, 4.5, 0, 0, 6.29); ctx.fill();
      ctx.drawImage(im, dx, dy, dw, dh);
    } else {
      if (w >= TILE*1.5){                                       // 落地阴影（背包缩略图不画）
        ctx.fillStyle="rgba(52,30,10,0.16)";
        ctx.beginPath(); ctx.ellipse(x+w/2, y+h-3, w*0.42, 5.5, 0, 0, 6.29); ctx.fill();
      }
      ctx.drawImage(im, x, y, w, h);
    }
    ctx.restore();
  }
  if (alpha!=null) ctx.restore();
}

// ---- 开了才有的效果：空调吹冷风 / 台灯亮起来（画在家具之后） ----
function drawAcFx(r, on){
  const cx = r.x + r.w*0.50, cy = r.y + r.h*0.60, rad = Math.max(5, r.w*0.21);
  if (on){                                                      // 冷气：三股白雾往下飘
    ctx.save(); ctx.lineCap="round";
    for (let i=0;i<3;i++){
      const ph = (g_animT*0.85 + i*0.34) % 1, a = 1-ph;
      const bx = r.x + r.w*(0.30 + i*0.20);
      ctx.strokeStyle = `rgba(186,236,252,${0.62*a})`;
      ctx.lineWidth = Math.max(2, r.w*0.06);
      ctx.beginPath();
      ctx.moveTo(bx, r.y + r.h - 4);
      ctx.quadraticCurveTo(bx + Math.sin(ph*7+i*2)*r.w*0.13, r.y + r.h + ph*r.h*0.35,
                           bx - Math.sin(ph*5+i)*r.w*0.07,   r.y + r.h + ph*r.h*0.72);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();                                                   // 前脸出风口：开着才转
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.29);
  ctx.fillStyle = on ? "rgba(14,36,50,0.88)" : "rgba(32,38,48,0.70)"; ctx.fill();
  ctx.strokeStyle = on ? "rgba(150,226,255,0.95)" : "rgba(116,128,146,0.60)";
  ctx.lineWidth = Math.max(1.2, r.w*0.035); ctx.stroke();
  if (on){
    ctx.translate(cx, cy); ctx.rotate(g_animT*7);
    ctx.fillStyle = "rgba(188,238,255,0.92)";
    for (let i=0;i<3;i++){
      ctx.rotate(Math.PI*2/3);
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(rad*0.80, -rad*0.30, rad*0.92, rad*0.16);
      ctx.quadraticCurveTo(rad*0.42,  rad*0.22, 0, 0);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle="rgba(96,108,124,0.50)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx-rad*0.65, cy); ctx.lineTo(cx+rad*0.65, cy); ctx.stroke();
  }
  ctx.restore();
}
function drawLampFx(r, on){
  if (!on) return;
  const lx = r.x + r.w*0.50, ly = r.y + r.h*0.24;                // 灯罩位置
  const rad = r.w*1.45;
  const gl = ctx.createRadialGradient(lx, ly, Math.max(1, r.w*0.10), lx, ly, rad);
  gl.addColorStop(0,    "rgba(255,236,175,0.72)");
  gl.addColorStop(0.42, "rgba(255,214,124,0.26)");
  gl.addColorStop(1,    "rgba(255,205,110,0)");
  ctx.save();
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(lx, ly, rad, 0, 6.29); ctx.fill();
  ctx.fillStyle = "rgba(255,228,152,0.28)";                      // 脚下（或桌面）那一片暖光
  ctx.beginPath(); ctx.ellipse(lx, r.y + r.h*0.96, r.w*0.72, Math.max(2, r.h*0.10), 0, 0, 6.29); ctx.fill();
  ctx.restore();
}
function drawFurnFx(it, r){                                      // 只给能开关的家具画
  if (it.kind==="ac")   drawAcFx(r, !!it.sw);
  if (it.kind==="lamp") drawLampFx(r, !!it.sw);
}
function drawRoomChar(){
  ctx.fillStyle="rgba(70,42,18,0.20)";                          // 影子
  ctx.beginPath(); ctx.ellipse(g_room.x, g_room.y-2, 24, 7, 0, 0, 6.29); ctx.fill();
  const c = CHARS[mySkin()] || CHARS[0];
  const walkIm = img("walk_"+c.key), idleIm = img("idle_"+c.key);
  const walking = !!(g_room.moving && walkIm);
  let im, frames, f, isIdle=false;
  if (walking){ im=walkIm; frames=6; f=(2+Math.floor(g_room.t*9))%frames; }
  else if (idleIm){ im=idleIm; frames=1; f=0; isIdle=true; }
  else if (walkIm){ im=walkIm; frames=6; f=2; }
  else { im=img(c.img); frames=c.frames; f=Math.floor(g_animT*7)%frames; }
  if (!im || !im.naturalWidth) return;
  const fw=im.naturalWidth/frames, fh=im.naturalHeight;
  const sc=1;                                                   // 宝可梦式比例：角色约 2 格高
  const bob = walking ? Math.abs(Math.sin(g_room.t*Math.PI*4.5))*2 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(g_room.x, g_room.y-bob);
  ctx.scale((isIdle?1:g_room.face)*sc, sc);
  ctx.drawImage(im, f*fw, 0, fw, fh, -fw/2, -fh, fw, fh);
  ctx.restore();
}
function drawRoomBag(){
  const b = roomBagBand();
  roundRect(b.x, b.y, b.w, b.h, 9);                             // 背板（MC 物品栏那种长条）
  ctx.fillStyle="rgba(26,18,14,0.82)"; ctx.fill();
  ctx.strokeStyle="rgba(226,196,132,0.55)"; ctx.lineWidth=2; ctx.stroke();
  roundRect(b.x+3, b.y+3, b.w-6, b.h-6, 7);
  ctx.strokeStyle="rgba(255,232,180,0.14)"; ctx.lineWidth=1; ctx.stroke();
  for (const sl of roomBagSlots()){
    const held = !!(g_hold && g_hold.kind===sl.f.kind);
    roundRect(sl.x, sl.y, sl.w, sl.h, 6);
    ctx.fillStyle = held ? "rgba(255,226,120,0.22)" : "rgba(0,0,0,0.32)"; ctx.fill();
    ctx.strokeStyle = held ? "rgba(255,232,140,0.95)" : "rgba(214,198,168,0.30)";
    ctx.lineWidth = held?2:1.2; ctx.stroke();
    const thumb = img(sl.f.img);
    const ar = (thumb && thumb.naturalWidth && thumb.naturalHeight) ? thumb.naturalWidth/thumb.naturalHeight : 2;
    let iw = sl.w*(sl.f.clear?0.56:0.80), ih = iw/ar;            // 按素材真实比例缩，1×1 的空调/台灯才不会被压扁
    const ihMax = sl.h*(sl.f.clear?0.62:0.60);
    if (ih > ihMax){ ih = ihMax; iw = ih*ar; }
    drawFurn(sl.f.kind, sl.x+(sl.w-iw)/2, sl.y+(sl.f.clear?4:Math.max(3, (ihMax-ih)/2)), iw, ih, 0, held?1:0.92);
    const lblSize = sl.w>=44 ? 9 : 8;
    const lbl = sl.f.clear ? "清除" : (sl.w>=44 ? `${sl.f.name} ${sl.f.w*sl.f.h}格` : sl.f.name);
    outlineText(lbl, 0, sl.y+sl.h-12, lblSize,
                held ? "#ffeaa0" : "rgba(240,232,212,0.82)", sl.x+sl.w/2, false);
    hot(sl.x-2, sl.y-2, sl.w+4, sl.h+4, ()=>{ playSfx("snd_menu_select"); roomHold(sl.i); });
  }
  const hd = g_hold ? furnDef(g_hold.kind) : null;
  const tip = g_hold
    ? (hd.clear
        ? "点房间里的家具拆掉 · B 收回工具"
        : ((isTouch ? "点地板放置 · 再点格子旋转" : "左键放置 · R 旋转") +
           (hd.stack ? " · 可放桌上" : "") + " · B 收回"))
    : "点下面的家具拿到手上（数字＝占几格）";
  outlineText(tip, 0, b.y-15, 11, g_hold ? "rgba(255,232,150,0.95)" : "rgba(250,244,232,0.80)", WINW/2, false);
}


// ---- 我的房间（白墙 + 方格地板 + 家具）
function RenderRoom(){
  // 白墙
  ctx.fillStyle="#f3f0e8"; ctx.fillRect(0,0,WINW,ROOM_WALL_Y);
  const wg=ctx.createLinearGradient(0,0,0,ROOM_WALL_Y);
  wg.addColorStop(0,"rgba(255,255,255,0.55)");
  wg.addColorStop(1,"rgba(206,200,186,0.30)");
  ctx.fillStyle=wg; ctx.fillRect(0,0,WINW,ROOM_WALL_Y);
  for (let x=0; x<WINW; x+=32){                 // 淡淡的墙纸竖条纹
    ctx.fillStyle="rgba(190,182,166,0.18)"; ctx.fillRect(x,0,16,ROOM_WALL_Y-14);
  }
  // 踢脚线
  ctx.fillStyle="#e8e3d8"; ctx.fillRect(0,ROOM_WALL_Y-14,WINW,14);
  ctx.fillStyle="rgba(120,104,84,0.35)"; ctx.fillRect(0,ROOM_WALL_Y-2,WINW,2);
  // 木地板
  ctx.fillStyle="#a9713e"; ctx.fillRect(0,ROOM_WALL_Y,WINW,WINH-ROOM_WALL_Y);
  const plank=40;                              // 40px 正方形瓷砖，格子对齐（宝可梦式）
  for (let row=0, y=ROOM_WALL_Y; y<WINH; y+=plank, row++){
    if (row%2) { ctx.fillStyle="rgba(255,232,196,0.08)"; ctx.fillRect(0,y,WINW,plank); } // 隔行微调明暗
    for (let x=0; x<WINW; x+=plank){
      if ((row+(x/plank|0))%2){ ctx.fillStyle="rgba(255,236,204,0.05)"; ctx.fillRect(x,y,plank,plank); } // 象棋格微差
    }
    ctx.fillStyle="rgba(88,52,22,0.34)";    ctx.fillRect(0,y,WINW,2);            // 横向缝
    for (let x=0; x<WINW; x+=plank){
      ctx.fillStyle="rgba(88,52,22,0.22)"; ctx.fillRect(x,y,2,plank);            // 竖向缝
    }
  }
  // 墙脚投在地板上的阴影
  const fg=ctx.createLinearGradient(0,ROOM_WALL_Y,0,ROOM_WALL_Y+26);
  fg.addColorStop(0,"rgba(60,38,18,0.22)"); fg.addColorStop(1,"rgba(60,38,18,0)");
  ctx.fillStyle=fg; ctx.fillRect(0,ROOM_WALL_Y,WINW,26);

  // ---- 建造模式：铺一层格子线，方便对齐
  if (g_hold){
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,0.18)"; ctx.lineWidth=1;
    const cols=roomCols(), rows=roomRows();
    for (let c=0;c<=cols;++c){ ctx.beginPath(); ctx.moveTo(c*TILE,ROOM_WALL_Y); ctx.lineTo(c*TILE,ROOM_WALL_Y+rows*TILE); ctx.stroke(); }
    for (let r=0;r<=rows;++r){ ctx.beginPath(); ctx.moveTo(0,ROOM_WALL_Y+r*TILE); ctx.lineTo(cols*TILE,ROOM_WALL_Y+r*TILE); ctx.stroke(); }
    ctx.restore();
  }

  // ---- 家具 + 角色：按底边从后往前画，站到家具后面会被挡住
  const draws = [];
  for (const it of g_roomFurn){
    const r = furnDrawRect(it);
    const base = furnPx(it.gx, it.gy, it.kind, it.rot);
    const sup  = it.on ? furnSupportOf(it) : null;
    const supB = sup ? furnPx(sup.gx, sup.gy, sup.kind, sup.rot) : base;
    const sy = it.on ? supB.y+supB.h+0.5 : base.y+base.h;       // 桌上的跟着桌子一起排序，但画在桌子之后
    draws.push({ y:sy, fn:()=>{
      drawFurn(it.kind, r.x, r.y, r.w, r.h, it.on?0:it.rot, null, !!it.on);
      if (furnDef(it.kind).sw) drawFurnFx(it, r);                // 空调冷风 / 台灯光晕
    } });
  }
  draws.push({ y:g_room.y, fn:drawRoomChar });
  draws.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());

  // ---- 可开关的家具：走到旁边给按键提示（触屏直接点它也行）
  if (!g_hold){
    const near = interTarget();
    if (near){
      const r = near.on ? furnDrawRect(near) : furnPx(near.gx, near.gy, near.kind, near.rot);
      const label = (isTouch ? "点一下 " : "E ") + (near.sw ? "关掉" : "打开") + furnDef(near.kind).name;
      ctx.font = 'bold 11px "Microsoft YaHei","PingFang SC",sans-serif';
      const tw = ctx.measureText(label).width, pw = tw + 18, ph = 20;
      const px = clamp(r.x + r.w/2 - pw/2, 4, Math.max(4, WINW-pw-4));
      const py = Math.max(ROOM_WALL_Y+3, r.y - ph - 6);
      ctx.save();
      roundRect(px, py, pw, ph, 7);
      ctx.fillStyle = "rgba(18,14,26,0.82)"; ctx.fill();
      ctx.strokeStyle = near.sw ? "rgba(255,226,140,0.85)" : "rgba(190,210,240,0.55)";
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      outlineText(label, 0, py+4, 11, near.sw ? "#ffe6a0" : "#dfe9ff", px+pw/2);
      hot(r.x, r.y, r.w, r.h, ()=>{ ToggleFurn(near); });        // 触屏：点家具本身
      hot(px, py, pw, ph, ()=>{ ToggleFurn(near); });            // 触屏：点提示条
    }
  }

  // ---- 清除工具：指针下的家具描红框
  if (g_hold && furnDef(g_hold.kind).clear){
    const hi = furnAt(g_mouse.x, g_mouse.y);
    if (hi >= 0){
      const it = g_roomFurn[hi];
      const r = furnHitRect(it);
      ctx.save();
      ctx.fillStyle="rgba(255,80,90,0.22)"; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle="rgba(255,120,130,0.95)"; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.strokeRect(r.x+1, r.y+1, r.w-2, r.h-2);
      ctx.restore();
    }
    if (hot) hot(0, ROOM_WALL_Y, roomCols()*TILE, roomRows()*TILE, ()=>{ PlaceHold(); });
  }

  // ---- 手上拎着的家具：半透明预览 + 能否放置
  if (g_hold && !furnDef(g_hold.kind).clear){
    const t = holdTiles();
    if (t){
      const ok = furnFree(t.gx, t.gy, g_hold.kind, g_hold.rot, t.on);
      const tmp = { kind:g_hold.kind, gx:t.gx, gy:t.gy, rot:g_hold.rot, on:t.on?1:0 };
      const dr = t.on ? furnDrawRect(tmp) : furnPx(t.gx, t.gy, g_hold.kind, g_hold.rot);
      ctx.save();
      ctx.fillStyle = ok ? (t.on ? "rgba(255,238,150,0.20)" : "rgba(110,255,170,0.20)")
                         : "rgba(255,90,110,0.20)";
      ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
      ctx.strokeStyle = ok ? (t.on ? "rgba(255,240,160,0.95)" : "rgba(150,255,190,0.95)")
                           : "rgba(255,120,140,0.95)";
      ctx.lineWidth = 2; ctx.setLineDash([6,4]);
      ctx.strokeRect(dr.x+1, dr.y+1, dr.w-2, dr.h-2);
      ctx.restore();
      drawFurn(g_hold.kind, dr.x, dr.y, dr.w, dr.h, t.on?0:g_hold.rot, 0.72, !!t.on);
    }
    hot(0, ROOM_WALL_Y, roomCols()*TILE, roomRows()*TILE, ()=>{ PlaceHold(); });
  }

  // ---- 底部背包栏
  drawRoomBag();

  // ---- 左上角操作提示 / 音乐提示
  outlineText(isTouch ? "方向键走路　·　点家具开关" : "方向键 / WASD 走路　·　E 开关家具　·　B 收回家具 / 返回", 12, 8, 11,
              "rgba(120,110,96,0.85)", -1, false);
  outlineText("家具素材 Cozy Space Furniture · Bramble & Byte · CC BY 4.0", 12, 24, 8,
              "rgba(130,118,100,0.55)", -1, false);   // 素材署名（CC BY 4.0 要求）
  if (bgmWant && bgm.paused)
    outlineText("♪ 按任意键 / 点一下屏幕 开启音乐", 0, ROOM_WALL_Y-24, 12,
                "rgba(196,140,40,0.95)", WINW/2, false);

  // ---- 顶部小提示（放置成功 / 放不下）
  if (g_toast){
    const a = Math.min(1, g_toast.t*1.7);
    ctx.save(); ctx.globalAlpha=a;
    outlineText(g_toast.txt, 0, ROOM_WALL_Y-46, 15, g_toast.col, WINW/2);
    ctx.restore();
  }
}

// ---- 主界面
function RenderTitle(){
  ctx.fillStyle = "rgb(12,8,22)";
  ctx.fillRect(0,0,WINW,WINH);
  outlineText("v"+GAME_VER, VOX+10, WINH-12, 10, "rgba(150,165,195,0.55)", -1, false);
  for (let i=0;i<5;++i){
    const y = (g_animT*26+i*120) % (WINH+120) - 60;
    ctx.fillStyle = "rgba(120,200,255,0.09)";
    ctx.fillRect(0,y,WINW,42);
  }
  outlineText("混沌挑战", 0, 22+VOY, 56, "#ffec78", WINW/2);
  outlineText("CHOOSE  YOUR  CHAOS", 0, 92+VOY, 15, "#c8dcff", WINW/2, false);

  // 账号 / 登录入口（左上角）：新存档带密码，可以在这里换回别的存档
  const lx = VOX+14, ly = VOY+8, lw = 152, lh = 30;
  const cloudOn = !!g_cloud.uid;
  roundRect(lx, ly, lw, lh, 8);
  ctx.fillStyle = "rgba(10,8,20,0.55)"; ctx.fill();
  ctx.strokeStyle = cloudOn ? "rgba(140,255,190,0.5)" : "rgba(160,190,255,0.45)";
  ctx.lineWidth = 1.4; ctx.stroke();
  outlineText(g_profile.name ? `${cloudOn ? "☁ " : "离线 "}${g_profile.name}` : "登录 / 注册",
              0, ly+7, 13, cloudOn ? "#9dffc4" : "#cfe0ff", lx+lw/2, false);
  hot(lx-4, ly-4, lw+8, lh+8, ()=>{ playSfx("snd_menu_move"); openLogin("", false); });

  // 我的房间（空房间，进去看看自己选的角色）
  const ry0 = ly+38;
  roundRect(lx, ry0, lw, lh, 8);
  ctx.fillStyle="rgba(10,8,20,0.55)"; ctx.fill();
  ctx.strokeStyle="rgba(255,214,120,0.5)"; ctx.lineWidth=1.4; ctx.stroke();
  outlineText(isTouch ? "我的房间" : "我的房间 · R", 0, ry0+7, 13, "#ffe9a8", lx+lw/2, false);
  hot(lx-4, ry0-4, lw+8, lh+8, ()=>{ playSfx("snd_menu_move"); net.selIdx=0; GoRoom(); });

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
    outlineText(BOSSES[i].name, 0, y+138, 22, sel?"#fff08c":"#d6d2dc", x+w/2);
    let sub = BOSSES[i].title;
    const dot = sub.indexOf("·");
    if (dot>=0) sub = sub.slice(dot+1);
    outlineText(sub, 0, y+164, 15, "#bec8dc", x+w/2, false);
    let star=""; for (let s=0;s<=i;++s) star+="★";
    outlineText(star, 0, y+182, 15, "#ff7896", x+w/2, false);
    // 打赢过 / 饶恕过：卡牌下方盖章（打赢才带道具，饶恕只记「饶恕」）
    const clr = !!(g_profile.cleared && g_profile.cleared[i]);
    const spr = !!(g_profile.spared  && g_profile.spared[i]);
    if (clr || spr){
      let mark, mcol, bg, fs=12;
      if (clr && spr){ mark="√ 成功 · ☮ 饶恕"; mcol="#a8efd6"; bg="rgba(150,220,255,0.13)"; fs=11; }
      else if (clr) { mark=`√ 成功 · ${ITEMS[i].short}`; mcol="#8ff0b8"; bg="rgba(120,255,180,0.13)"; }
      else          { mark="☮ 饶恕"; mcol="#8fe0ff"; bg="rgba(120,200,255,0.15)"; }
      ctx.fillStyle=bg;
      ctx.fillRect(x+6, y+195, w-12, 15);
      outlineText(mark, 0, y+196, fs, mcol, x+w/2, false);
    }
  }
  outlineText(isTouch?"方向键选择　A 开战　·　点右上角头像可改名":"← → 选择　Z 开战　·　点右上角头像可改名", 0, 352+VOY, 15, "#d2dce1", WINW/2, false);
  // 联机信息
  if (net.role){
    outlineText(isLeader() ? "已组队：与 "+net.partnerName+"（TA 将与你一起挑战）"
                           : (isTouch ? "已组队：队长 "+net.partnerName+" · 点队伍状态可退队"
                                      : "已组队：队长 "+net.partnerName+" · Enter 退出组队"),
                0, 382+VOY, 14, "#ffd257", WINW/2, false);
  } else if (net.on){
    outlineText(isTouch ? "点右上角在线人数 可查看玩家并邀请组队"
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
function btn(x,y,w,h,label,fn,fs){
  ctx.fillStyle="rgba(60,50,90,0.9)";
  ctx.strokeStyle="#9a8ec0"; ctx.lineWidth=2;
  roundRect(x,y,w,h,8); ctx.fill(); ctx.stroke();
  outlineText(label, 0, y+h/2-(fs||20)*0.55, fs||20, "#fff", x+w/2);
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

  if (g_boot){                                // 开机先确认云账号：别让旧存档闪一下再跳登录页
    ctx.fillStyle = "rgb(12,8,22)"; ctx.fillRect(0,0,WINW,WINH);
    outlineText("正在连接云端…", 0, WINH/2-16, 20, "#9fb4e8", WINW/2, false);
    outlineText("账号和存档都在云上，换电脑也能接着打", 0, WINH/2+12, 12, "#6f80a8", WINW/2, false);
    return;
  }
  if (g_state!==ST_CREATE && g_state!==ST_LOGIN && g_state!==ST_SETPWD && g_state!==ST_SYNC && g_state!==ST_SIGNUP) hideInput();
  if (g_state===ST_CREATE){ RenderCreate(); drawVPad(); return; }
  if (g_state===ST_LOGIN){ RenderLogin(); drawVPad(); return; }
  if (g_state===ST_SETPWD){ RenderSetPwd(); drawVPad(); return; }
  if (g_state===ST_SYNC){ RenderSync(); drawVPad(); return; }
  if (g_state===ST_SIGNUP){ RenderSignup(); drawVPad(); return; }
  if (g_state===ST_ROOM){ RenderRoom(); drawVPad(); return; }
  if (g_state===ST_TITLE){ RenderTitle(); drawAvatar(); drawVPad(); return; }
  if (g_state===ST_PAUSE){                 // 暂停只画背景 + 菜单，避免战斗画面文字叠影
    const bg0 = img("bg");
    if (bg0) ctx.drawImage(bg0, -6, -6, WINW+12, WINH+12);
    ctx.drawImage(GetCrt(), 0, 0, WINW, WINH);
    RenderPause();
    drawAvatar();
    drawVPad();
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

  // ---- 我方角色（左侧）
  drawFighters();

  // ---- boss 立绘（右侧，脚踩同一条地面线）
  const bk = JEV_H / (g_boss===1?340 : g_boss===2?336 : g_boss===3?215 : 168);
  let jx = JEV_CX + g_jevOffX*(g_state===ST_ATTACK?1:0);
  let jy = JEV_CY + g_jevOffY*(g_state===ST_ATTACK?1:0) + bob + sy;
  if (g_state===ST_INTRO)
    jy = -200 + (JEV_CY+bob)*Math.min(1, g_stateT/1.1);
  let jw=JEV_W, jh=JEV_H;
  if (g_state!==ST_LOSE){
    let jf=null;
    if (g_boss===0){
      if (g_state===ST_WIN||g_state===ST_SPARE){ jf=img("jevil_spared")||img("jevil"); const sc=1+Math.sin(g_animT*2)*0.03; jw*=sc; jh*=sc; }
      else if (g_hitFlash>0 && frameCount("jevil_hurt_",8)>0){
        jf=IMG["jevil_hurt_"+(Math.floor(g_animT*24)%8)]; jw=200*bk; jh=130*bk;
      }
      else if (g_jevHp<Boss().maxhp*0.25 && img("jevil_tired")) jf=img("jevil_tired");
      else { const n=jevilJumpN(); jf = n>0?IMG["jevil_jump_"+(Math.floor(g_animT*9)%n)]:img("jevil"); }
    } else {
      jf = BossFrame(g_boss, g_hitFlash>0);
      if (g_jevHp<Boss().maxhp*0.25){ jx+=rnd(-3,3); jy+=rnd(-3,3); }
      if (g_hitFlash>0){ jx+=rnd(-5,5); }
    }
    if (jf){
      ctx.save(); ctx.imageSmoothingEnabled=false;
      drawImg(jf, jx+sx, jy, jw, jh);
      ctx.restore();
    }
  }
  // 刀光画在 Boss 之上
  // 命中白闪
  if (g_hitFlash>0){
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.34,g_hitFlash*1.1)})`;
    ctx.beginPath(); ctx.ellipse(jx+sx, jy, JEV_W*0.34, JEV_H*0.36, 0, 0, 6.29); ctx.fill();
  }
  // boss 血条
  if (g_jevHpShown && g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_SPARE){
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
  if (g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_SPARE) {
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
  if (g_subtitle && g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_SPARE){
    let dup=false;
    if (g_state===ST_ATTACK && g_stateT<Boss().warn){
      for (let i=0;i<4;++i) if (Boss().pat[i]===g_pattern && Boss().patLine[i]===g_subtitle){ dup=true; break; }
    }
    if (!dup) outlineText(g_subtitle, 0, 246+VOY, 20, "#ffe058", WINW/2);
  }
  // ---- 底部 UI（贴屏幕底边，预留手机手势条/安全区）
  const UI_BOT = WINH - SAFE_B;          // 底部 UI 的基准线
  if (g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_SPARE && g_state!==ST_INTRO){
    // 手机上把 HP 挪到左上角：左下角要让给方向键
    const byy = isTouch ? 10 : UI_BOT-72;
    outlineText("HP", 14, byy-4, 22, "#ffe678", -1);
    ctx.fillStyle="rgba(40,15,25,0.86)"; ctx.fillRect(46,byy,110,18);
    ctx.fillStyle="#ffc850"; ctx.fillRect(46,byy,110*(g_hp/maxHp()),18);
    ctx.fillStyle="rgba(255,255,200,0.9)"; ctx.fillRect(46,byy,110*(g_hp/maxHp()),6);
    ctx.strokeStyle="rgba(240,240,245,1)"; ctx.lineWidth=1.6; ctx.strokeRect(46,byy,110,18);
    outlineText(`${Math.ceil(g_hp)}/${Math.floor(maxHp())}`, 160, byy-2, 15, "#fff", -1, false);

    // 本回合生效的道具/技能增益（小字贴在 HP 右侧，免得挤占战斗区）
    const bl=[];
    if (g_buff.scythe) bl.push("镰刀待发 ×2");
    if (g_buff.tv) bl.push("电视护盾 30%");
    if (g_buff.fuse) bl.push("引线 -30%");
    if (g_buff.guitar>0) bl.push(`音波 ×${g_buff.guitar}`);
    if (g_buff.weaken>0) bl.push("剑威 敌攻-50%");
    if (g_buff.regen>0) bl.push(`药水 ×${g_buff.regen}`);
    if (bl.length) outlineText(bl.join("　"), 272, byy+1, 11, "#8fe6ff", -1, false);

    // 战斗菜单四项（常驻显示，用方向键选、A 确认）
    const btnKeys=["btn_fight","btn_act","btn_item","btn_mercy"];
    const rowW = isTouch ? Math.min(404, Math.max(248, WINW-2*172)) : 404;
    const slot = rowW/4;
    const rowX = (WINW-rowW)/2;
    for (let i=0;i<4;++i){
      let bx=rowX+i*slot+2, by=UI_BOT-50, bw=slot-4, bh=34;
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
    }
  }

  renderNetHUD(UI_BOT);   // 联机 HUD：右下角在线人数/队伍/邀请

  // ---- FIGHT 时机条：直接扫在空着的战斗框里（不再盖住场上的角色和 Boss）
  if (g_state===ST_FIGHT || (g_state===ST_DMG && g_stateT<0.4)){
    ctx.save(); ctx.translate(VOX,VOY);
    const y0=BOX_Y0+12, y1=BOX_Y1-12, hh=y1-y0;
    ctx.fillStyle="rgba(255,240,200,0.05)"; ctx.fillRect(250,y0,142,hh);
    ctx.strokeStyle="rgba(255,250,250,0.75)"; ctx.lineWidth=2;
    ctx.strokeRect(250,y0,142,hh);
    // 完美时机：中间那道竖线
    ctx.strokeStyle="#ffdc5a"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(321,y0); ctx.lineTo(321,y1); ctx.stroke();
    ctx.fillStyle="#ffdc5a";
    ctx.beginPath(); ctx.moveTo(321,y0-6); ctx.lineTo(315,y0-16); ctx.lineTo(327,y0-16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(321,y1+6); ctx.lineTo(315,y1+16); ctx.lineTo(327,y1+16); ctx.closePath(); ctx.fill();
    // 扫动的红条
    if (!g_barHit || g_stateT<0.35){
      ctx.fillStyle="rgba(255,60,60,0.30)"; ctx.fillRect(g_barX-9, y0, 18, hh);
      ctx.fillStyle="#ff3c3c"; ctx.fillRect(g_barX-3, y0-4, 6, hh+8);
    }
    ctx.restore();
    ctx.save(); ctx.translate(VOX,VOY);
    outlineText(isTouch?"按 A 出刀！":"按 Z 出刀！", BOX_X0+16, BOX_CY-9, 17, "#fff", -1);
    ctx.restore();
  }

  // ---- 子菜单（画在战斗框上，跟随场景偏移）
  if (g_state===ST_SUB){
    ctx.save(); ctx.translate(VOX,VOY);
    if (g_sub===SM_ITEM){
      // 道具页：软糖 + 掉落的四件道具，右侧一行写效果
      const list=itemList(), rowH=21, y0=BOX_Y0+16;
      for (let i=0;i<list.length;++i){
        const it=list[i], y=y0+i*rowH, sel=(i===g_subSel);
        const used = it.kind==="candy" ? (g_items<=0) : (gearLeft(it.key)<=0);
        if (sel){
          ctx.fillStyle="rgba(255,236,140,0.13)";
          ctx.fillRect(BOX_X0+12, y-3, BOX_X1-BOX_X0-24, rowH-2);
          ctx.save(); ctx.imageSmoothingEnabled=false;
          drawImg(img("soul"), BOX_X0+18, y-2, 15,15); ctx.restore();
        }
        const col = sel ? "#fffbe0" : (used?"rgba(150,152,172,0.72)":"#d8c8d2");
        outlineText(itemLabel(it), BOX_X0+39, y-3, 16, col, -1);
        outlineText(used?"已用完":itemHint(it), BOX_X0+190, y, 12,
                    used?"rgba(160,160,180,0.65)":"#93a8d8", -1, false);
      }
    } else {
      const sk = mySkill();
      const left = skillLeft();
      const opts = g_sub===SM_ACT ? [sk.name,"检查","安抚"] : ["饶恕","逃跑"];
      const nOpt = opts.length;
      const step = nOpt>2 ? 34 : 42;
      for (let i=0;i<nOpt;++i){
        const y=BOX_Y0+(nOpt>2?36:34)+i*step;
        const isSkill = (g_sub===SM_ACT && i===0);
        const gone = isSkill && left<=0;                       // 本局用过了
        let col;
        if (isSkill) col = gone ? (i===g_subSel?"rgba(190,180,190,0.85)":"rgba(150,152,172,0.62)")
                                : (i===g_subSel?sk.col:"rgba(255,255,255,0.78)");
        else         col = i===g_subSel?"#fff":"#d8c8d2";
        outlineText(opts[i], BOX_X0+44, y-8, isSkill?21:20, col, -1);
        if (i===g_subSel){ ctx.save(); ctx.imageSmoothingEnabled=false;
          drawImg(img("soul"), BOX_X0+24, y-5, 22,22); ctx.restore(); }
        if (isSkill) outlineText(gone ? "本局已用掉" : `★ ${skillPerTxt(sk)}`, BOX_X0+178, y-2, 10.5,
                                 gone ? "rgba(160,160,180,0.7)"
                                      : (i===g_subSel?"rgba(255,240,190,0.92)":"rgba(170,190,225,0.8)"), -1, false);
      }
      if (g_sub===SM_ACT){
        const note = skillLeft()>0 ? `★ 每局一次 · 消耗一回合行动`
                                   : `★ 本局已用掉 · 再点只会白白消耗一回合`;
        outlineText(note, BOX_X0+44, BOX_Y0+9, 11,
                    skillLeft()>0?"rgba(160,185,225,0.78)":"rgba(255,150,150,0.85)", -1, false);
      }
      if (g_sub===SM_MERCY && g_spareReady){
        const im=img("sparkle");
        if (im){ ctx.save(); ctx.imageSmoothingEnabled=false;
          drawImg(im, BOX_X0+124, BOX_Y0+22, 34,34, g_animT*160); ctx.restore(); }
        outlineText("!!", BOX_X0+96, BOX_Y0+16, 22, "#ffe65a", -1);
      }
      if (g_sub===SM_MERCY)
        outlineText("饶恕 = 放它走 · 不算胜利、不掉道具（卡牌下会记下饶恕）",
                    BOX_X0+24, BOX_Y1-28, 11, "rgba(150,205,240,0.85)", -1, false);
      outlineText(isTouch?"B 返回":"X 返回", BOX_X1-74, BOX_Y0+10, 14, "#9aa8c8", -1, false);
    }
    ctx.restore();
  }

  // ---- 伤害数字（场景坐标）
  ctx.save(); ctx.translate(VOX,VOY);
  for (const d of g_dmg){
    const a=Math.min(1, d.life*2);
    const col = d.miss ? `rgba(180,180,190,${a})` : (d.heal ? `rgba(120,255,170,${a})` : `rgba(255,235,80,${a})`);
    outlineText(d.miss?"MISS":(d.heal?`+${d.val}`:String(d.val)), d.x, d.y, 34, col, d.x);
  }
  ctx.restore();

  // ---- 胜利 / 失败
  if (g_state===ST_WIN || g_state===ST_LOSE || g_state===ST_SPARE){
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
    const isWin=g_state===ST_WIN, isSpare=g_state===ST_SPARE;
    const big = isWin ? "胜  利 ！" : (isSpare ? "饶  恕" : "GAME OVER");
    outlineText(big, 0, 150, 56, isWin?"#ffeb5a":(isSpare?"#8fe0ff":"#ff4646"), WINW/2);
    const flavor = isWin
      ? `${Boss().name}被打倒了，混沌暂时散去……`
      : isSpare
        ? `${Boss().name}安静地睡着了……（饶恕不算胜利，也没有战利品）`
        : (net.role ? "两个人都倒下了……再试一次？" : "但你还有机会——重新挑战，或者换个对手。");
    outlineText(flavor, 0, 232, 20, isSpare?"#cfe9ff":"#ebd8c8", WINW/2);
    if (isSpare){
      const it=ITEMS[g_boss];
      outlineText(`卡牌下方已记下「☮ 饶恕」${it?"　·　"+it.name+" 没有掉落":""}`, 0, 274, 15, "#8fe0ff", WINW/2, false);
    }
    let tipY = 330;
    if (g_state===ST_WIN && g_lastDrop){
      const it=ItemByKey(g_lastDrop);
      if (it){
        const cy=274, label=`获得道具：${it.name}`;
        ctx.font=`bold 22px "Microsoft YaHei","PingFang SC",sans-serif`;
        const tw=ctx.measureText(label).width;
        const lx=WINW/2+14;                        // 文字中心（左移留出图标位）
        drawItemIcon(g_lastDrop, lx-tw/2-26, cy+11, 30);
        outlineText(label, 0, cy, 22, it.color, lx);
        outlineText(`${it.perTxt} · ${it.desc}　·　战斗里在 ITEM 中使用`, 0, cy+32, 13, "#c8d4ee", WINW/2, false);
        tipY = 356;
      }
    }
    if ((g_animT%1)<0.65){
      const tip = isMember()
        ? (isTouch?"点队伍状态 退出队伍":"Enter 退出队伍")
        : (isTouch?"按 A 重新挑战":"Z 重新挑战　　ESC 返回主界面");
      outlineText(tip, 0, tipY, 22, "#fff", WINW/2);
    }
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
  if (g_state>=ST_INTRO && g_state!==ST_WIN && g_state!==ST_LOSE && g_state!==ST_SPARE){
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
    }
    outlineText(isTouch?"← → 选择　A 确认":"← → 选择　Z 确认", 0, WINH*0.42+70, 14, "#c9d2e8", WINW/2, false);
  } else if (net.role && g_dead && g_deadChoice && g_state!==ST_LOSE){
    if (isTouch) outlineText("观战中 · 暂停键退出", 0, 8, 12, "#8fa0c8", WINW/2, false);
    else rightText("观战中 · 暂停键退出", WINW-10, 46, 12, "#8fa0c8");
  }

  // ---- 联机暂停面板（不冻结游戏，盖在最上层）
  if (g_pauseUI) RenderPauseUI();

  // ---- 操作提示
  if (g_state===ST_MENU && !isTouch)
    outlineText("方向键选择  Z确认  X取消", 12, 10, 15, "#b4d2ff", -1, false);

  // ---- 道具生效提示（顶部短暂浮现）
  if (g_toast){
    const a=Math.min(1, g_toast.t*1.7);
    ctx.save(); ctx.globalAlpha=a;
    outlineText(g_toast.txt, 0, 8, 18, g_toast.col, WINW/2);
    ctx.restore();
  }

  // ---- 右上角自己的角色（存档选的外貌，一直显示）
  drawAvatar();

  // ---- 触屏常驻按键（画在最上层，盖住面板也能操作）
  drawVPad();
}

// 触屏虚拟按键：上左下右 + A(确定) / B(返回)
function drawVPad(){
  if (!PAD.on) return;
  const pressed = new Set(vptr.values());
  for (const id of ["up","down","left","right"]){
    const q=PAD[id], p=pressed.has(id);
    ctx.save();
    roundRect(q.x,q.y,q.w,q.h,Math.max(10,q.w*0.20));
    ctx.fillStyle = p ? "rgba(255,226,110,0.30)" : "rgba(10,8,20,0.26)";
    ctx.fill();
    ctx.strokeStyle = p ? "rgba(255,236,140,0.95)" : "rgba(212,222,255,0.42)";
    ctx.lineWidth = p?2.4:1.5; ctx.stroke();
    const cx=q.x+q.w/2, cy=q.y+q.h/2, s=q.w*0.20;
    ctx.beginPath();
    if (id==="up")   { ctx.moveTo(cx,cy-s*1.1); ctx.lineTo(cx+s,cy+s*0.75); ctx.lineTo(cx-s,cy+s*0.75); }
    if (id==="down") { ctx.moveTo(cx,cy+s*1.1); ctx.lineTo(cx+s,cy-s*0.75); ctx.lineTo(cx-s,cy-s*0.75); }
    if (id==="left") { ctx.moveTo(cx-s*1.1,cy); ctx.lineTo(cx+s*0.75,cy+s); ctx.lineTo(cx+s*0.75,cy-s); }
    if (id==="right"){ ctx.moveTo(cx+s*1.1,cy); ctx.lineTo(cx-s*0.75,cy+s); ctx.lineTo(cx-s*0.75,cy-s); }
    ctx.closePath();
    ctx.fillStyle = p ? "#fffbe0" : "rgba(236,242,255,0.88)";
    ctx.fill();
    ctx.restore();
  }
  for (const [id,ch,cap,col] of [["a","A","确定","rgba(125,255,176,0.85)"],["b","B","返回","rgba(255,156,174,0.85)"]]){
    const q=PAD[id], p=pressed.has(id);
    ctx.save();
    ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,Math.PI*2);
    ctx.fillStyle = p ? "rgba(255,226,110,0.34)" : "rgba(10,8,20,0.30)";
    ctx.fill();
    ctx.strokeStyle = p ? "rgba(255,238,150,1)" : col;
    ctx.lineWidth = p?3:2; ctx.stroke();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font = `bold ${Math.round(q.r*0.80)}px "Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.fillStyle="#fff";
    ctx.fillText(ch, q.x, q.y-q.r*0.22);
    ctx.font = `${Math.round(q.r*0.42)}px "Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.fillStyle= p?"#fff6c8":"rgba(232,238,255,0.9)";
    ctx.fillText(cap, q.x, q.y+q.r*0.52);
    ctx.restore();
  }
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
  // 右上角让给角色头像，暂停键整体左移
  const x=WINW-(AVATAR.on ? AVATAR.w + AVATAR.pad*2 + 8*VSC : 0)-44, y=10, w=34, h=30;
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
  // 离线也画这行状态。以前 `if (!net.on && !net.role) return;` 会让 CDN 没加载 /
  // 连不上 broker 的电脑右下角一片空白，看起来像「在线人数没了」。
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
  // ---- 在线人数 / 队伍状态
  // 手机：右下角整块让给 A/B 拇指区 → 挪到右上角（战斗时贴在暂停键下方）
  const oc=netOnline();
  const stTxt=netStatusText();
  const lh=17;
  const inBattle = uiBot!==undefined && g_state!==ST_TITLE && g_state!==ST_MENU;
  const st = net.on ? (net.role ? "#ffd257" : "#7dffa8") : "#9aa2bc";
  let hy, panelTop;
  if (isTouch){
    // 右上角被角色头像占了 → 在线/队伍信息排在头像下面（标题界面还要给「改名」让一行）
    hy = AVATAR.on ? (AVATAR.y + AVATAR.h + AVATAR.pad + 5*VSC)
                   : ((g_state>=ST_INTRO && g_state!==ST_TITLE) ? 46 : 6);
    rightPillText(stTxt, WINW-10, hy-2, 13, st);
    if (net.role){
      const tag = (isLeader() ? "红心·队长" : "蓝心·队员") + (net.dcOk ? " ·直连" : " ·中转");
      rightText(tag+" 与 "+net.partnerName, WINW-10, hy+17, 11, "#c9d2e8");
      rightText("点此退队", WINW-10, hy+31, 10, "#8fa0c8");
      hot(WINW-212, hy+13, 204, 32, netLeave);        // 手机：点队伍状态退队
    }
    if ((g_state===ST_TITLE || g_state===ST_MENU) && !net.role)
      hot(WINW-160, hy-8, 154, 26, ()=>{
        if (net.on){ net.panel=!net.panel; net.selIdx=0; } else netUserRetry();
      });
    panelTop = hy + (net.role?48:24);                 // 面板从信息块下方展开
  } else {
    const bot = inBattle ? uiBot-56 : WINH-14;
    const nLines = 1 + (net.role ? 1 : 0);
    hy = bot - (15 + (nLines-1)*lh);
    rightPillText(stTxt, WINW-10, hy-2, 14, st);
    if (net.role){
      const tag = (isLeader() ? "红心·队长" : "蓝心·队员") + (net.dcOk ? " ·直连" : " ·中转");
      rightText(tag+"  与 "+net.partnerName, WINW-10, hy+lh, 12, "#c9d2e8");
    }
    // 在线人数可点（开/关玩家面板；离线时点它重连）
    if ((g_state===ST_TITLE || g_state===ST_MENU) && !net.role)
      hot(WINW-150, hy-8, 144, 26, ()=>{
        if (net.on){ net.panel=!net.panel; net.selIdx=0; } else netUserRetry();
      });
    panelTop = hy-10;
  }
  // ---- 玩家面板
  if (net.panel && (g_state===ST_TITLE||g_state===ST_MENU)){
    const L=netLobbyList();
    const pw=300, rowH=30, head=52, foot=26;
    const ph=head + Math.max(1,Math.min(L.length,6))*rowH + foot;
    const px0=WINW-pw-16, py0=clamp(panelTop-ph, 8, WINH-ph-8);
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
  // ---- 队友 HP（手机：跟着自己的 HP 一起放左上角；桌面：叠在自己 HP 条上方）
  if (net.role && net.php!==undefined && uiBot!==undefined && g_state!==ST_TITLE){
    const pw=Math.max(0,Math.min(1,net.php/(net.pmh||PLAYER_MAXHP)));
    const ty = isTouch ? 46 : uiBot-94;
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

// 资源加载完成 → 有存档直接进主界面，没有就先起名设密码选外貌
loadFinishCb = ()=>{
  document.getElementById("loading").style.display="none";
  avatarLayout();
  playVoice("Jevil_voiceclip_CHAOS.wav");
  requestAnimationFrame(t=>{ lastT=t; loop(t); });
  const imp = importFromHash();               // 旧域名页面套 iframe 时，把老存档带过来
  notifyParent(imp);                          // 告诉外层壳：游戏起来了（可撤掉加载层）
  bootAccount();                              // 账号/存档可能要走网络，先跑起来再决定进哪一页
};

// ---- 被旧域名页面用 iframe 承载时：接收外层传来的老存档，并回报「已就绪」
function importFromHash(){
  let applied = 0;
  try {
    const m = (location.hash || "").match(/[#&]imp=([A-Za-z0-9_-]+)/);
    if (!m) return 0;
    const b = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "===".slice(0, (4 - b.length % 4) % 4);
    const bin = atob(b + pad);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!localStorage.getItem(SAVE_KEY)){        // 云端版这边还是空的才搬，别覆盖已有进度
      for (const k of Object.keys(obj)){
        if (!/^sanjiao_/.test(k)) continue;
        try { localStorage.setItem(k, obj[k]); } catch(e){}
      }
      applied = 1;
      loadProfile();                             // 内存里的 g_profile 也要同步成搬过来的这份
    }
    history.replaceState(null, "", location.pathname + location.search);
  } catch(e){}
  return applied;
}
function notifyParent(imp){
  try {
    if (window.parent && window.parent !== window)
      window.parent.postMessage({ sj:"ready", imp: imp|0 }, "*");
  } catch(e){}
}

async function bootAccount(){
  g_boot = true;
  const ca = currentAccount();
  const c = await waitCloud(4000);            // SDK 从 CDN 来，可能比游戏晚到一会儿
  let ok = false;
  if (c){                                     // 有云端会话：直接恢复（最多等 6 秒，不能卡死开局）
    try {
      ok = await Promise.race([
        cloudRestore(),
        new Promise(r=>setTimeout(()=>r(false), 6000))
      ]);
    } catch(e){ ok = false; }
  }
  g_boot = false;
  if (ca && ca.acc) applyAccount(ca.user);    // 本机缓存：断网也能接着玩
  if (ok){ GoTitle(); return; }               // 云端会话还在：直接进
  let out = false;
  try { out = localStorage.getItem(LOGOUT_KEY) === "1"; } catch(e){}
  if (!out && ca && ca.acc && !ca.acc.pwd){ GoTitle(); return; }   // 本机离线存档
  if (!c && ca && ca.acc && !ca.acc.pwd){ GoTitle(); return; }     // 云组件没加载：照旧离线玩
  openLogin("", false);                       // 邮箱框留空：本机昵称不是账号
}
// 若音频事件不触发（缓存），兜底检查
setTimeout(function poll(){
  if (loadFinishCb && loadDone>=loadTotal){ loadFinishCb(); loadFinishCb=null; }
  else if (loadFinishCb) setTimeout(poll, 300);
}, 500);
