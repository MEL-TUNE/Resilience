'use strict';
/* 名前と着せ替え（ページ表示前に適用） */

const OTONOHA_NS=location.protocol==='file:'?'':'haishin-';
// 分けたページ（obs.html＝配信（OBS）用、rec.html＝収録用）。index.html は全部入り。保存場所は3つとも共有する
const OTONOHA_TARGET=(typeof OTONOHA_BUILD_TARGET==='string'&&OTONOHA_BUILD_TARGET)||'';
if(OTONOHA_TARGET)document.documentElement.dataset.target=OTONOHA_TARGET;
const LOOK_KEY=OTONOHA_NS?'meltune-haishin-studio-look-v1':'meltune-kissa-studio-look-v1';

const LOOK_PRESETS={
  kissaten:{name:'抹茶ラテ',bg:'#e8dfce',paper:'#faf4e6',accent:'#234c40',decor:'#a47c42'},

  creamsoda:{name:'クリームソーダ',bg:'#dff0de',paper:'#f8fcf6',accent:'#56a678',decor:'#e04a5c'},

  napolitan:{name:'ナポリタン',bg:'#f7e2d4',paper:'#fff9f3',accent:'#d2623c',decor:'#7d9b52'},

  lemon:{name:'レモンスカッシュ',bg:'#f9efc6',paper:'#fffdf2',accent:'#d6ac2c',decor:'#78a556'},

  bluehawaii:{name:'ブルーハワイ',bg:'#dbebf6',paper:'#f7fbfe',accent:'#4189c4',decor:'#f0c43c'},

  grape:{name:'ぶどうゼリー',bg:'#e8dff3',paper:'#fbf8fd',accent:'#8158b5',decor:'#a6c452'},

  strawberry:{name:'いちごパフェ',bg:'#f8dee6',paper:'#fff8fa',accent:'#de5b82',decor:'#8b5a48'},

  hotchoco:{name:'ホットショコラ',bg:'#36271f',paper:'#46342b',accent:'#d8a873',decor:'#c2775c'},

  purin:{name:'プリンアラモード',bg:'#fbe09a',paper:'#fffaf0',accent:'#7a3a14',decor:'#e8264a'},

  omurice:{name:'オムライス',bg:'#ffd75e',paper:'#fffbe8',accent:'#b8141f',decor:'#7a4422'},

  coffeejelly:{name:'コーヒーゼリー',bg:'#170f0b',paper:'#2b1c14',accent:'#f6ead6',decor:'#c98a4b'},

  nightsoda:{name:'夜のクリームソーダ',bg:'#0b201d',paper:'#14332d',accent:'#7ee8a8',decor:'#ff4f6a'},
  // 0.11.1：配信処（洋菓子・ダイナー）と甘味処（和菓子）の色。看板の文字と色の差（コントラスト比）は、どれも4.5以上にしてある
  macaron:{name:'マカロン',bg:'#f6e3ec',paper:'#fffafc',accent:'#a8406a',decor:'#6fb9a4'},
  cherrycola:{name:'チェリーコーラ',bg:'#fbe7e4',paper:'#fffaf6',accent:'#b8323f',decor:'#3f8f8a'},
  mintshake:{name:'ミントシェイク',bg:'#dff3ec',paper:'#f8fffc',accent:'#21705c',decor:'#e8708e'},
  anmitsu:{name:'抹茶あんみつ',bg:'#e3ecd8',paper:'#fbfcf6',accent:'#4f6e3a',decor:'#8a4b5e'},
  sakuramochi:{name:'桜もち',bg:'#f7e4e8',paper:'#fffafb',accent:'#a8435f',decor:'#6d8f5a'},
  kinako:{name:'黒蜜きなこ',bg:'#efe2c8',paper:'#fffaf0',accent:'#5a3a22',decor:'#c9a35b'}
};

const LOOK_COLOR_KEYS=['bg','paper','accent','decor'];
// 色は全部の部屋で共有する。選ぶ画面では、部屋の献立ごとにまとめて並べる（どの部屋でも、どの色でも選べる）
const LOOK_ROOMS=[
  {key:'haishin',name:'配信処の色（洋菓子・ダイナー）',presets:['macaron','cherrycola','mintshake','strawberry','purin','grape']},
  {key:'kissa',name:'純喫茶の色（喫茶の献立）',presets:['kissaten','creamsoda','napolitan','omurice','lemon','bluehawaii','hotchoco','coffeejelly','nightsoda']},
  {key:'kanmi',name:'甘味処の色（和菓子）',presets:['anmitsu','sakuramochi','kinako']}
];
// 部屋の名前（分けたページの看板の上に出す）
const LOOK_ROOM_OF_TARGET={obs:{name:'配信処',en:'LIVE STAGE'},rec:{name:'純喫茶',en:'RECORDING ROOM'},ai:{name:'甘味処',en:'AI ATELIER'}};

const LOOK_DEFAULT={title:'配信処オトノハ',subtitle:'',eyebrow:'LIVE＆RADIO',preset:'kissaten',...LOOK_PRESETS.kissaten};

function lookSanitize(v){
  v=v&&typeof v==='object'?v:{};
  const out={...LOOK_DEFAULT};

  if(typeof v.title==='string'&&v.title.trim()&&v.title.trim()!=='純喫茶オトノハ')out.title=v.title.trim().slice(0,30);

  if(typeof v.subtitle==='string')out.subtitle=v.subtitle.slice(0,80);
  if(typeof v.eyebrow==='string'&&v.eyebrow!=='RADIO & SOUND')out.eyebrow=v.eyebrow.slice(0,30);

  if(v.preset==='custom'||Object.prototype.hasOwnProperty.call(LOOK_PRESETS,v.preset))out.preset=v.preset;

  if(out.preset!=='custom')Object.assign(out,LOOK_PRESETS[out.preset]);

  for(const k of LOOK_COLOR_KEYS)if(out.preset==='custom'&&typeof v[k]==='string'&&/^#[0-9a-f]{6}$/i.test(v[k]))out[k]=v[k].toLowerCase();

  delete out.name;
  return out;
}

function lookLuminance(hex){
  const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722
}

const lookInk=hex=>lookLuminance(hex)>.179?'#2e211c':'#fbf3e8';

function lookLoad(){
  try{
    return lookSanitize(JSON.parse(localStorage.getItem(LOOK_KEY)||'null'))
  }catch(_){
    return lookSanitize(null)
  }
}

function lookPaint(v){
  const st=document.documentElement.style,
    dark=lookLuminance(v.paper)<=.179;

  for(const k of LOOK_COLOR_KEYS)st.setProperty('--'+k,v[k]);

  st.setProperty('--ink',lookInk(v.paper));
  st.setProperty('--on-accent',lookInk(v.accent));
  st.setProperty('--on-decor',lookInk(v.decor));

  st.setProperty('--hi',dark?`color-mix(in srgb,${v.paper} 86%,#ffffff)`:'#ffffff');

  document.documentElement.dataset.tone=dark?'dark':'light';

  document.title=v.title+(typeof OTONOHA_TARGET==='string'&&LOOK_ROOM_OF_TARGET[OTONOHA_TARGET]?'｜'+LOOK_ROOM_OF_TARGET[OTONOHA_TARGET].name:'');

  const t=document.getElementById('appTitle'),
    s=document.getElementById('appSub'),
    e=document.getElementById('appEyebrow');
  if(t)t.textContent=v.title;
  if(s){
    s.textContent=v.subtitle;
    s.hidden=!v.subtitle
  }
  if(e){
    e.textContent=v.eyebrow;
    e.hidden=!v.eyebrow
  }
}

let look=lookLoad();
lookPaint(look);
