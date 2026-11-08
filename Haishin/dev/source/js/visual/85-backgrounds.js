/* 背景画像：名義ごと・映像の向き（横 16:9／縦 9:16／3:4）ごとに10枚まで。位置と拡大は画像ごとに保存する */

  const BG_MAX=10,BG_ASPECTS={landscape:'横 16:9',portrait:'縦 9:16',x34:'3:4'};
  const bgLoading=new Set(),bgThumbs=new Map();
  function bgProf(){const p=curProfile();if(!p)return null;if(!p.bgs||typeof p.bgs!=='object')p.bgs={};if(!p.bgSel||typeof p.bgSel!=='object')p.bgSel={};return p}
  function bgList(p=bgProf(),asp=state.aspect){if(!p)return [];if(!Array.isArray(p.bgs[asp]))p.bgs[asp]=[];return p.bgs[asp]}
  function bgCur(){const p=bgProf();if(!p)return null;const l=bgList(p);return l.find(b=>b.id===p.bgSel[state.aspect])||l[0]||null}
  // 画像は使うときに読み込む（全名義・全部の向きを最初に読み込むと重くなるため）
  function bgImage(b){
    const id='bgi-'+b.id;
    if(images[id])return images[id];
    if(!bgLoading.has(id)){
      bgLoading.add(id);
      getAsset(ASSET+id).then(async blob=>{if(blob){images[id]=await decode(blob);assetBlobs[id]=blob}}).catch(()=>{}).finally(()=>bgLoading.delete(id))
    }
    return null
  }
  // 縦横同じ倍率で、枠いっぱいに敷く（はみ出した分は、位置の指定で見せる場所を選ぶ）
  function coverImgAt(cg,im,b){
    const z=Math.max(100,Math.min(300,b.z||100))/100,s=Math.max(W/im.width,H/im.height)*z,dw=im.width*s,dh=im.height*s;
    cg.drawImage(im,(W-dw)*(b.x??50)/100,(H-dh)*(b.y??50)/100,dw,dh)
  }
  async function bgThumb(b){
    if(bgThumbs.has(b.id))return bgThumbs.get(b.id);
    const blob=assetBlobs['bgi-'+b.id]||await getAsset(ASSET+'bgi-'+b.id);
    if(!blob)return '';
    const u=URL.createObjectURL(blob);bgThumbs.set(b.id,u);return u
  }
  function renderBgList(){
    const p=bgProf();
    if(!p||!E('bgList'))return;
    const l=bgList(p),cur=bgCur();
    E('bgWhere').textContent='名義「'+p.name+'」・'+BG_ASPECTS[state.aspect]+'の背景（'+l.length+'/'+BG_MAX+'枚）';
    E('bgList').replaceChildren(...l.map(b=>{
      const btn=document.createElement('button');btn.type='button';btn.className='bg-item'+(cur&&b.id===cur.id?' selected':'');
      btn.setAttribute('aria-pressed',String(!!cur&&b.id===cur.id));btn.title=b.name;
      const im=document.createElement('img');im.alt='';bgThumb(b).then(u=>{if(u)im.src=u});
      const sp=document.createElement('span');sp.textContent=b.name;
      btn.append(im,sp);
      btn.onclick=()=>{p.bgSel[state.aspect]=b.id;state.bg='image';E('studioBg').value='image';syncChar();save();renderBgList()};
      return btn
    }));
    if(!l.length)E('bgList').append(Object.assign(document.createElement('span'),{className:'studio-mini',textContent:'まだ登録がありません'}));
    E('bgAdd').disabled=l.length>=BG_MAX;
    E('bgEdit').hidden=!cur;
    if(cur){
      for(const [id,k,df] of [['bgX','x',50],['bgY','y',50],['bgZ','z',100]]){E(id).value=cur[k]??df;E(id+'Val').textContent=(cur[k]??df)+'%'}
      E('bgName').value=cur.name
    }
    E('bgUseNote').hidden=state.bg==='image'||!l.length
  }
  E('bgAdd').onclick=()=>E('bgFile').click();
  E('bgFile').onchange=async e=>{
    const files=[...e.target.files];e.target.value='';
    const p=bgProf();if(!p||!files.length)return;
    const l=bgList(p);let n=0;
    for(const f of files){
      if(l.length>=BG_MAX){toast('1つの向きに登録できる背景画像は'+BG_MAX+'枚までです',4000);break}
      const id=Math.random().toString(36).slice(2,12);
      try{
        if(!ready)throw Error('保存領域の準備中です。少し待ってください');
        await installAsset('bgi-'+id,f,f.name);
        l.push({id,name:f.name.replace(/\.(png|webp|jpe?g)$/i,'').slice(0,40)||'背景',x:50,y:50,z:100});
        p.bgSel[state.aspect]=id;n++
      }catch(err){toast(err.message,5000)}
    }
    if(n){state.bg='image';E('studioBg').value='image';syncChar();save();renderBgList();toast(BG_ASPECTS[state.aspect]+'の背景画像を'+n+'枚登録しました',3000)}
  };
  for(const [id,k,lo,hi] of [['bgX','x',0,100],['bgY','y',0,100],['bgZ','z',100,300]])E(id).oninput=e=>{
    const b=bgCur();if(!b)return;b[k]=Math.max(lo,Math.min(hi,Math.round(Number(e.target.value))));E(id+'Val').textContent=b[k]+'%';save()
  };
  E('bgName').oninput=e=>{const b=bgCur();if(!b)return;b.name=e.target.value.slice(0,40)||'背景';save();clearTimeout(E('bgName')._t);E('bgName')._t=setTimeout(renderBgList,500)};
  E('bgDel').onclick=e=>armed(e.currentTarget,'もう一度押すと外す',async()=>{
    const p=bgProf(),b=bgCur();if(!p||!b)return;
    try{await deleteAsset(ASSET+'bgi-'+b.id)}catch(_){}
    delete images['bgi-'+b.id];delete assetBlobs['bgi-'+b.id];delete state.assetNames['bgi-'+b.id];
    if(bgThumbs.has(b.id)){URL.revokeObjectURL(bgThumbs.get(b.id));bgThumbs.delete(b.id)}
    p.bgs[state.aspect]=bgList(p).filter(x=>x!==b);
    p.bgSel[state.aspect]=p.bgs[state.aspect][0]?.id||'';
    save();renderBgList();toast('背景画像を外しました')
  });
  // .live 書き出し用：まだ読み込んでいない背景画像も渡す
  async function bgAllBlobs(){
    const out={};
    for(const p of state.profiles||[])for(const a of Object.keys(BG_ASPECTS))for(const b of (p.bgs?.[a]||[])){
      const id='bgi-'+b.id;if(assetBlobs[id])continue;
      try{const blob=await getAsset(ASSET+id);if(blob)out[id]=blob}catch(_){}
    }
    return out
  }
