(() => {
  'use strict';
  const defaults = {icon:'emblem',customImage:'',background:'#eee6db',paper:'#fffaf4',accent:'#80273e',gold:'#a08360'};
  const presets = {
    ivory: {...defaults,icon:'jewel'},
    midnight: {...defaults,icon:'jewel',background:'#191821',paper:'#24222d',accent:'#702b43',gold:'#c9ac82'},
    lavender: {...defaults,icon:'wisteria',background:'#ebe6f3',paper:'#fcf9ff',accent:'#665079',gold:'#9a7c9e'},
    forest: {...defaults,icon:'woodland',background:'#e6ece5',paper:'#f8fbf5',accent:'#355c4c',gold:'#96815c'},
    honey: {...defaults,icon:'chizuru',background:'#f2ead8',paper:'#fffaf0',accent:'#82612e',gold:'#ab884e'}
  };
  const assets = {emblem:'assets/rio-icon.svg',jewel:'assets/rio-jewel.png',wisteria:'assets/rio-wisteria.png',woodland:'assets/rio-woodland.png',chizuru:'assets/chizuru-honey.png'};
  const $ = id => document.getElementById(id);
  const colorKeys = ['background','paper','accent','gold'];
  let draft = {...defaults}, generation = 0;
  function sanitize(value) {
    const v = value && typeof value === 'object' ? value : {};
    const out = {...defaults};
    for (const key of colorKeys) if (typeof v[key] === 'string' && /^#[0-9a-f]{6}$/i.test(v[key])) out[key] = v[key];
    if (typeof v.customImage === 'string' && v.customImage.length <= 600000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(v.customImage)) out.customImage = v.customImage;
    if (Object.prototype.hasOwnProperty.call(assets,v.icon) || v.icon === 'custom' && out.customImage) out.icon=v.icon;
    return out;
  }
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  }
  function ink(hex) {return luminance(hex) > .179 ? '#241d24' : '#fffaf4';}
  function source(v) {return v.icon==='custom' ? v.customImage : assets[v.icon];}
  function apply(value, name) {
    const v=sanitize(value), style=document.documentElement.style;
    for (const key of colorKeys) style.setProperty('--dress-'+key,v[key]);
    style.setProperty('--dress-ink',ink(v.paper));
    style.setProperty('--dress-page-ink',ink(v.background));
    style.setProperty('--dress-panel-ink',ink(v.accent));
    const icon=$('heroIcon'); icon.onerror=()=>{icon.onerror=null;icon.src=assets.emblem;};icon.src=source(v);
    icon.alt=(name || '彼岸リオ')+'のアイコン';
    $('readerTitle').textContent=(name || '彼岸リオ')+' Reader';
    document.title=(name || '彼岸リオ')+' Reader';
  }
  function render() {
    for(const key of colorKeys) $(key+'Color').value=draft[key];
    $('iconChoice').value=draft.icon;
    $('customIconOption').disabled=!draft.customImage;
    $('appearancePreviewImage').src=source(draft);
    const preview=$('appearancePreview');
    preview.style.background=draft.background;
    preview.style.color=ink(draft.background);
    $('appearancePreviewPaper').style.background=draft.paper;
    $('appearancePreviewPaper').style.color=ink(draft.paper);
    $('appearancePreviewButton').style.background=draft.accent;
    $('appearancePreviewButton').style.color=ink(draft.accent);
    preview.style.borderColor=draft.gold;
    $('appearancePreviewTitle').textContent=$('rioSpeaker').textContent+' Reader';
  }
  function open(value) {
    generation++;draft=sanitize(value);$('appearanceNotice').textContent='変更は「着せ替えを保存」で反映します。';
    $('appearanceSave').disabled=false;$('customIconFile').value='';render();$('appearanceDialog').showModal();
  }
  function close() {generation++;$('appearanceDialog').close();}
  async function upload(file) {
    if(!file)return;
    const token=++generation;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){$('appearanceNotice').textContent='PNG・JPEG・WebPの画像を選んでください（8MBまで）。';$('customIconFile').value='';return;}
    $('appearanceSave').disabled=true;$('appearanceNotice').textContent='画像を準備しています。';
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();img.src=url;await img.decode();
      if(img.width*img.height>40000000)throw Error('large');
      const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
      const ctx=canvas.getContext('2d');const size=Math.min(img.width,img.height);
      ctx.drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,384,384);
      const data=canvas.toDataURL('image/webp',.88);
      if(data.length>600000)throw Error('large');
      if(token!==generation)return;
      draft.customImage=data;draft.icon='custom';render();
      $('appearanceNotice').textContent='画像を中央の正方形に整えました。保存すると、このブラウザに記録します。';
    } catch {
      if(token===generation)$('appearanceNotice').textContent='この画像を読み込めませんでした。別のPNG・JPEG・WebP画像をお試しください。';
    } finally {
      URL.revokeObjectURL(url);
      if(token===generation){$('appearanceSave').disabled=false;$('customIconFile').value='';}
    }
  }
  function init(onSave) {
    $('iconChoice').addEventListener('change',()=>{draft.icon=$('iconChoice').value;render();});
    for(const key of colorKeys)$(key+'Color').addEventListener('input',()=>{draft[key]=$(key+'Color').value;render();});
    for(const key of Object.keys(presets))$('preset-'+key).addEventListener('click',()=>{
      const custom=draft.icon==='custom';
      draft={...presets[key],icon:custom?'custom':presets[key].icon,customImage:draft.customImage};
      $('appearanceNotice').textContent=custom?'配色を変更しました。自分の画像はそのまま維持します。':'配色に合うアイコンも選びました。保存すると反映します。';
      render();
    });
    $('customIconFile').addEventListener('change',()=>upload($('customIconFile').files[0]));
    $('appearanceReset').addEventListener('click',()=>{generation++;draft={...defaults};$('appearanceSave').disabled=false;$('appearanceNotice').textContent='標準の見た目を選びました。保存すると反映します。';render();});
    $('appearanceCancel').addEventListener('click',close);
    $('appearanceDialog').addEventListener('cancel',()=>{generation++;});
    $('appearanceSave').addEventListener('click',()=>{if(onSave(sanitize(draft))!==false)close();else $('appearanceNotice').textContent='保存できませんでした。ブラウザの保存容量などをご確認ください。';});
  }
  window.RioAppearance={sanitize,apply,open,init,ink};
})();

