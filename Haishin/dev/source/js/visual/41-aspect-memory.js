/* 映像の向き（横 16:9／縦 9:16／3:4）ごとに、立ち絵の位置・大きさ、マスコットの位置・大きさ・傾き、
   準備中・離席中・配信終了の画像の大きさ・位置、降らせる演出（季節・画像のプリセット）の量と大きさを覚える。
   いま使っている値（state.x・y・scale、マスコットの x・y・size・tilt）は、いまの向きのもの。
   向きを変えるときに、いまの値を前の向きの控え（pos[向き]）に残し、次の向きの控えがあればそれに戻す。 */

  // 設定を読み込むとき（このファイルより先に動く）にも使うので、定数は関数の中に置く。
  // 立ち絵の範囲は、設定画面のつまみと同じ CHAR_RANGES（00-state.js）を使う
  function aspectPosClean(v,kind){
    const keys=kind==='msc'?[['x',-100,100],['y',-100,100],['size',3,90],['tilt',-180,180]]:['x','y','scale'].map(k=>[k,CHAR_RANGES[k][0],CHAR_RANGES[k][1]]);
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
  // 降らせる演出の控え（量 count・大きさ fxSize）。範囲は 01-sanitize.js のつまみと同じ
  function fxPosClean(v){
    const out={};
    if(!v||typeof v!=='object')return out;
    for(const a of ['landscape','portrait','x34']){
      const q=v[a];if(!q||typeof q!=='object')continue;
      const c=Number(q.count),z=Number(q.fxSize);
      if(Number.isFinite(c)&&Number.isFinite(z))out[a]={count:Math.max(5,Math.min(100,c)),fxSize:Math.max(35,Math.min(200,z))}
    }
    return out
  }
  const fxTargets=()=>[...Object.values(state.fxSeason||{}),...(state.fxPresets||[])].filter(t=>t&&typeof t==='object');
  function charPosKeep(c,asp=state.aspect){if(!c)return;if(!c.pos||typeof c.pos!=='object')c.pos={};c.pos[asp]={x:state.x,y:state.y,scale:state.scale}}
  function charPosApply(c,asp=state.aspect){const q=c?.pos?.[asp];if(q){state.x=q.x;state.y=q.y;state.scale=q.scale;c.x=q.x;c.y=q.y;c.scale=q.scale}}
  function aspectStash(asp){
    syncChar();
    charPosKeep(curChar(),asp);
    for(const m of state.mascots||[]){if(!m.pos||typeof m.pos!=='object')m.pos={};m.pos[asp]={x:m.x,y:m.y,size:m.size,tilt:m.tilt||0}}
    for(const k of ['standby','away','end']){const c=state.scenes[k];if(!c.pos||typeof c.pos!=='object')c.pos={};c.pos[asp]={imgSize:c.imgSize,imgX:c.imgX,imgY:c.imgY}}
    seasonPut();
    for(const t of fxTargets()){if(!t.pos||typeof t.pos!=='object')t.pos={};t.pos[asp]={count:t.count,fxSize:t.fxSize}}
  }
  function aspectRestore(asp){
    charPosApply(curChar(),asp);
    for(const m of state.mascots||[]){const r=m.pos?.[asp];if(r){m.x=r.x;m.y=r.y;m.size=r.size;m.tilt=r.tilt}}
    for(const k of ['standby','away','end']){const c=state.scenes[k],r=c.pos?.[asp];if(r){c.imgSize=r.imgSize;c.imgX=r.imgX;c.imgY=r.imgY}}
    for(const t of fxTargets()){const r=t.pos?.[asp];if(r){t.count=r.count;t.fxSize=r.fxSize}}
    seasonLoad();
    renderSceneForm();
    // 走る・お散歩の途中の位置は画面の寸法で持っているので、向きを変えたら決めた位置からやり直す
    for(const o of [mscRun,mscWalk,mscPlay])for(const k of Object.keys(o))delete o[k]
  }
