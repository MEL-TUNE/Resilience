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
      if(Object.keys(o).length===keys.length){if(kind==='msc'&&(q.t===0||q.t===1))o.t=q.t;out[a]=o}
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
  // 控えに「この向きで大きさを直したか」の印 t を付ける。0.10.4 までの控え（t なし）で、まだ判断していないものは t なしのまま残す
  function aspTag(n,old,x){if(x._sz||x._t||old?.t===1)n.t=1;else if(!(old&&old.t===undefined))n.t=0;return n}
  // つまみで大きさを直したら、その場でいまの向きの控えに印を付ける（切り替える前に読み込み直しても消えないように）
  function aspMarkSize(x,fields){x._sz=true;if(!x.pos||typeof x.pos!=='object')x.pos={};x.pos[state.aspect]={...fields,t:1}}
  function aspectStash(asp){
    syncChar();
    charPosKeep(curChar(),asp);
    for(const m of state.mascots||[]){if(!m.pos||typeof m.pos!=='object')m.pos={};const o=m.pos[asp];m.pos[asp]=aspTag({x:m.x,y:m.y,size:m.size,tilt:m.tilt||0},o,m);m._sz=false}
    for(const k of ['standby','away','end']){const c=state.scenes[k];if(!c.pos||typeof c.pos!=='object')c.pos={};const o=c.pos[asp];c.pos[asp]=aspTag({imgSize:c.imgSize,imgX:c.imgX,imgY:c.imgY},o,c);c._sz=false}
    seasonPut();
    for(const t of fxTargets()){if(!t.pos||typeof t.pos!=='object')t.pos={};t.pos[asp]={count:t.count,fxSize:t.fxSize}}
  }
  // マスコットと場面の画像の大きさは「画面の高さに対する％」。高さの違う向き（横720・縦1280・3:4 1280）へ移るとき、
  // 自分で大きさを直していない控えは、画面上の大きさが変わらない％に換算する（0.10.5）。
  // 控えの t：1＝その向きで大きさを直した、0＝直していない、なし＝0.10.4 までの控え（前の向きと同じ値なら写しとみなす）
  const ASP_H={landscape:720,portrait:1280,x34:1280};
  function aspSizeConv(v,from,to,lo,hi){const a=ASP_H[from],b=ASP_H[to];return a&&b&&a!==b?Math.max(lo,Math.min(hi,Math.round(v*a/b*1e4)/1e4)):v}
  function aspectRestore(asp,prev){
    charPosApply(curChar(),asp);
    for(const m of state.mascots||[]){
      const r=m.pos?.[asp],q=prev&&m.pos?.[prev],cur=m.size;
      const tuned=!!r&&(r.t===1||(r.t===undefined&&!!q&&r.size!==q.size));
      if(r){m.x=r.x;m.y=r.y;m.tilt=r.tilt}
      m.size=tuned?r.size:prev?aspSizeConv(cur,prev,asp,3,90):r?r.size:cur;
      m._t=tuned;m._sz=false
    }
    for(const k of ['standby','away','end']){
      const c=state.scenes[k],r=c.pos?.[asp],q=prev&&c.pos?.[prev],cur=c.imgSize;
      const tuned=!!r&&(r.t===1||(r.t===undefined&&!!q&&r.imgSize!==q.imgSize));
      if(r){c.imgX=r.imgX;c.imgY=r.imgY}
      c.imgSize=tuned?r.imgSize:prev?aspSizeConv(cur,prev,asp,10,150):r?r.imgSize:cur;
      c._t=tuned;c._sz=false
    }
    for(const t of fxTargets()){const r=t.pos?.[asp];if(r){t.count=r.count;t.fxSize=r.fxSize}}
    seasonLoad();
    renderSceneForm();
    // 走る・お散歩の途中の位置は画面の寸法で持っているので、向きを変えたら決めた位置からやり直す
    for(const o of [mscRun,mscWalk,mscPlay])for(const k of Object.keys(o))delete o[k]
  }
