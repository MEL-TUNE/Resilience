/* 映像の向き（横 16:9／縦 9:16／3:4）ごとに、立ち絵の位置・大きさと、マスコットの位置・大きさ・傾きを覚える。
   いま使っている値（state.x・y・scale、マスコットの x・y・size・tilt）は、いまの向きのもの。
   向きを変えるときに、いまの値を前の向きの控え（pos[向き]）に残し、次の向きの控えがあればそれに戻す。 */

  // 設定を読み込むとき（このファイルより先に動く）にも使うので、定数は関数の中に置く
  function aspectPosClean(v,kind){
    const keys=kind==='msc'?[['x',-100,100],['y',-100,100],['size',3,90],['tilt',-180,180]]:[['x',-100,100],['y',-100,100],['scale',10,500]];
    const out={};
    if(!v||typeof v!=='object')return out;
    for(const a of ['landscape','portrait','x34']){
      const q=v[a];if(!q||typeof q!=='object')continue;
      const o={};
      for(const [k,lo,hi] of keys){const n=Number(q[k]);if(!Number.isFinite(n))break;o[k]=Math.max(lo,Math.min(hi,n))}
      if(Object.keys(o).length===keys.length)out[a]=o
    }
    return out
  }
  function charPosKeep(c,asp=state.aspect){if(!c)return;if(!c.pos||typeof c.pos!=='object')c.pos={};c.pos[asp]={x:state.x,y:state.y,scale:state.scale}}
  function charPosApply(c,asp=state.aspect){const q=c?.pos?.[asp];if(q){state.x=q.x;state.y=q.y;state.scale=q.scale;c.x=q.x;c.y=q.y;c.scale=q.scale}}
  function aspectStash(asp){
    syncChar();
    charPosKeep(curChar(),asp);
    for(const m of state.mascots||[]){if(!m.pos||typeof m.pos!=='object')m.pos={};m.pos[asp]={x:m.x,y:m.y,size:m.size,tilt:m.tilt||0}}
  }
  function aspectRestore(asp){
    charPosApply(curChar(),asp);
    for(const m of state.mascots||[]){const r=m.pos?.[asp];if(r){m.x=r.x;m.y=r.y;m.size=r.size;m.tilt=r.tilt}}
    // 走る・お散歩の途中の位置は画面の寸法で持っているので、向きを変えたら決めた位置からやり直す
    for(const o of [mscRun,mscWalk,mscPlay])for(const k of Object.keys(o))delete o[k]
  }
