/* 秋・冬の演出に使う絵（葉5枚・実5個・雪10枚）。絵そのものは autumn-art.json（build.py が index.html の隣に置く） */

  const autumnPics={leaf:[],nut:[],snow:[]},
    autumnIdx=(p,kind)=>kind==='leaf'?(p.i+Math.floor(p.i/5))%5:Math.floor(p.i/5)%5,
    SNOW_CRYSTAL=[0,3,4,5,6,7,8,9],SNOW_SPARK=[1,2],
    snowIdx=(p,kind)=>kind==='mote'?SNOW_SPARK[p.i%2]:SNOW_CRYSTAL[Math.floor(p.i/3)%8];
  // 絵は、秋・冬の演出を選んで描くときに初めて読み込む（ページを開くたびに読まない）。
  // 読み込めないとき（ネットにつながっていない・ファイルを直接開いたなど）は、絵の代わりの図形で描き、30秒たったら読み直す
  let autumnState=0,autumnRetryAt=0;
  function autumnNeed(){
    if(autumnState===1||autumnState===2)return;
    if(autumnState===3&&performance.now()<autumnRetryAt)return;
    autumnState=1;
    fetch(new URL('autumn-art.json',location.href)).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(A=>{
      for(const k of ['leaf','nut','snow'])(A[k]||[]).forEach((src,n)=>{const im=new Image();im.onload=()=>{autumnPics[k][n]=im};im.src=src});
      autumnState=2
    }).catch(()=>{autumnState=3;autumnRetryAt=performance.now()+30000})
  }
