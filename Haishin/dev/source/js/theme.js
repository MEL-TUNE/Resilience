'use strict';
/* 名前と着せ替え（ページ表示前に適用） */

const OTONOHA_NS=location.protocol==='file:'?'':'haishin-';
// 分けたページ（obs.html＝配信（OBS）用、rec.html＝収録用）。index.html は全部入り。保存場所は3つとも共有する
const OTONOHA_TARGET=(typeof OTONOHA_BUILD_TARGET==='string'&&OTONOHA_BUILD_TARGET)||'';
if(OTONOHA_TARGET)document.documentElement.dataset.target=OTONOHA_TARGET;
const LOOK_KEY=OTONOHA_NS?'meltune-haishin-studio-look-v1':'meltune-kissa-studio-look-v1';

// 0.11.2：食べ物の色をより美味しそうに（地は食べ物の色を薄く、差し色は食べ物そのものの色、装飾は添え物の色）
const LOOK_PRESETS={
  kissaten:{name:'抹茶ラテ',bg:'#e3e1c4',paper:'#fbf8ec',accent:'#2f5e34',decor:'#b0814f'},

  creamsoda:{name:'クリームソーダ',bg:'#d6f0d2',paper:'#fbfff6',accent:'#22804c',decor:'#e2304f'},

  napolitan:{name:'ナポリタン',bg:'#fbdcc8',paper:'#fffaf3',accent:'#c2421c',decor:'#5e8f36'},

  lemon:{name:'レモンスカッシュ',bg:'#faefb8',paper:'#fffdf0',accent:'#d8a515',decor:'#6fa142'},

  bluehawaii:{name:'ブルーハワイ',bg:'#d3eaf8',paper:'#f7fbff',accent:'#1c72b3',decor:'#f2c230'},

  grape:{name:'ぶどうゼリー',bg:'#eadcf3',paper:'#fcf8fe',accent:'#6b3a9f',decor:'#94bb3a'},

  strawberry:{name:'いちごパフェ',bg:'#fbd9e2',paper:'#fff8fa',accent:'#c42d58',decor:'#c38a4d'},

  hotchoco:{name:'ホットショコラ',bg:'#3a2419',paper:'#4b3124',accent:'#e6b47c',decor:'#d2806a'},

  purin:{name:'プリンアラモード',bg:'#fbe1a0',paper:'#fffaee',accent:'#7a3810',decor:'#e0233f'},

  omurice:{name:'オムライス',bg:'#ffd968',paper:'#fffbea',accent:'#b0121c',decor:'#5f9235'},

  coffeejelly:{name:'コーヒーゼリー',bg:'#170f0b',paper:'#2b1c14',accent:'#f6ead6',decor:'#c98a4b'},

  nightsoda:{name:'夜のクリームソーダ',bg:'#0b201d',paper:'#14332d',accent:'#7ee8a8',decor:'#ff4f6a'},
  // 0.11.1：配信処（洋菓子・ダイナー）と甘味処（和菓子）の色。看板の文字と色の差（コントラスト比）は、どれも4.5以上にしてある
  macaron:{name:'マカロン',bg:'#f6e3ec',paper:'#fffafc',accent:'#a8406a',decor:'#6fb9a4'},
  cherrycola:{name:'チェリーコーラ',bg:'#f8e0dc',paper:'#fffaf6',accent:'#a8222f',decor:'#6b3a2a'},
  mintshake:{name:'ミントシェイク',bg:'#d6f1e5',paper:'#f8fffb',accent:'#1f6e58',decor:'#6b4636'},
  anmitsu:{name:'抹茶あんみつ',bg:'#e0ead0',paper:'#fbfcf4',accent:'#466a2c',decor:'#7a3146'},
  sakuramochi:{name:'桜もち',bg:'#f9dfe6',paper:'#fffafb',accent:'#a8435f',decor:'#5e8a4e'},
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
