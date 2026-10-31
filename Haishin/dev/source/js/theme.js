'use strict';
/* 名前と着せ替え（ページ表示前に適用） */

const OTONOHA_NS=location.protocol==='file:'?'':'haishin-';
const LOOK_KEY=OTONOHA_NS?'meltune-haishin-studio-look-v1':'meltune-kissa-studio-look-v1';

const LOOK_PRESETS={
  kissaten:{name:'抹茶ラテ',bg:'#e8dfce',paper:'#faf4e6',accent:'#234c40',decor:'#a47c42'},

  creamsoda:{name:'クリームソーダ',bg:'#dff0de',paper:'#f8fcf6',accent:'#56a678',decor:'#e04a5c'},

  napolitan:{name:'ナポリタン',bg:'#f7e2d4',paper:'#fff9f3',accent:'#d2623c',decor:'#7d9b52'},

  lemon:{name:'レモンスカッシュ',bg:'#f9efc6',paper:'#fffdf2',accent:'#d6ac2c',decor:'#78a556'},

  bluehawaii:{name:'ブルーハワイ',bg:'#dbebf6',paper:'#f7fbfe',accent:'#4189c4',decor:'#f0c43c'},

  grape:{name:'ぶどうゼリー',bg:'#e8dff3',paper:'#fbf8fd',accent:'#8158b5',decor:'#a6c452'},

  strawberry:{name:'いちごパフェ',bg:'#f8dee6',paper:'#fff8fa',accent:'#de5b82',decor:'#8b5a48'},

  hotchoco:{name:'ホットショコラ',bg:'#36271f',paper:'#46342b',accent:'#d8a873',decor:'#c2775c'}
};

const LOOK_COLOR_KEYS=['bg','paper','accent','decor'];

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

  document.title=v.title;

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
