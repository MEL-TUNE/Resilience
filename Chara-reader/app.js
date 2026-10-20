(() => {
"use strict";

const $ = id => document.getElementById(id);
const synth = window.speechSynthesis;
const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const LEGACY_LINES = {"ready":"「ほほう。長文ですわね。では、上から順に片づけてまいりましょうか」","play":"「では始めますわ。目は休ませて、耳だけこちらへ」","pause":"「一旦停止ですわね。続きはここで預かっておきますわ」","finish":"「以上。読了ですわ。なかなかの長丁場でしたわね」","empty":"「研究対象が空っぽですわ。まず文章を寄越してちょうだい」","error":"「あら。これは読み上げ側で事故が起きましたわね」"};
const PREVIOUS_LINES = {"ready":"読みたい文章を、こちらへ。少し目を休める時間にしましょう。","play":"では、続きを読み進めますわ。どうぞ、楽な姿勢で。","pause":"ここでひと息入れましょう。続きは、この文から再開できますわ。","finish":"最後まで読み終えました。少し余韻を楽しむのもよいですわね。","empty":"まだ文章が入っていないようですわ。入力欄に貼り付けてから、再生してください。","error":"読み上げが止まったようです。音声の設定を確かめて、もう一度お試しください。"};
const STORAGE_KEY = "higanRio.reader.sales.v1";

const els = {
  text:$("textInput"), paste:$("pasteBtn"), open:$("openBtn"), save:$("saveBtn"), preview:$("previewBtn"),
  file:$("fileInput"), play:$("playBtn"), pause:$("pauseBtn"), stop:$("stopBtn"), prev:$("prevBtn"),
  next:$("nextBtn"), voice:$("voiceSelect"), rate:$("rateRange"), rateLabel:$("rateLabel"),
  pitch:$("pitchRange"), pitchLabel:$("pitchLabel"), skipUrls:$("skipUrls"), progressBig:$("progressBig"),
  progressSmall:$("progressSmall"), now:$("nowReading"), reset:$("resetBtn"), badge:$("supportBadge"),
  rio:$("rioLine"), charCount:$("charCount"), chunkCount:$("chunkCount"), estimate:$("estimate"),
  previewDialog:$("previewDialog"), previewBody:$("previewBody"), settingsDialog:$("settingsDialog"),
  settingsBtn:$("settingsBtn"), skipExactInput:$("skipExactInput"), skipContainsInput:$("skipContainsInput"),
  displayNameInput:$("displayNameInput"), readyLineInput:$("readyLineInput"), playLineInput:$("playLineInput"),
  pauseLineInput:$("pauseLineInput"), finishLineInput:$("finishLineInput"), saveSettingsBtn:$("saveSettingsBtn"),
  restoreDefaultsBtn:$("restoreDefaultsBtn"), exportSettingsBtn:$("exportSettingsBtn"),
  importSettingsBtn:$("importSettingsBtn"), settingsFileInput:$("settingsFileInput")
};

let voices = [];
let chunks = [];
let currentIndex = 0;
let sessionToken = 0;
let lastPreparedText = "";
let appConfig = structuredClone(window.RIO_DEFAULT_CONFIG);

function deepClone(v){ return JSON.parse(JSON.stringify(v)); }

function mergeConfig(base, patch){
  const out = deepClone(base);
  if (!patch || typeof patch !== "object") return out;
  if (typeof patch.displayName === "string") out.displayName = patch.displayName;
  if (patch.lines && typeof patch.lines === "object") {
    for (const key of Object.keys(out.lines)) {
      if (typeof patch.lines[key] === "string") out.lines[key] = patch.lines[key];
    }
  }
  if (Array.isArray(patch.skipExactLines)) out.skipExactLines = patch.skipExactLines.map(String);
  if (Array.isArray(patch.skipContains)) out.skipContains = patch.skipContains.map(String);
  out.appearance=window.RioAppearance.sanitize(patch.appearance);
  return out;
}

function saveState(){
  const state = {
    text: els.text.value,
    currentIndex,
    rate:Number(els.rate.value),
    pitch:Number(els.pitch.value),
    voiceURI:els.voice.value,
    skipUrls:els.skipUrls.checked,
    config:appConfig,
    copyVersion:3
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("saveNotice").textContent = "文章と読み上げ位置を、このブラウザに自動保存します。";
    return true;
  } catch {
    $("saveNotice").textContent = "自動保存ができません。必要な文章は「TXT保存」で手元に残してください。";
    return false;
  }
}

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if(typeof s.text === "string") els.text.value = s.text;
    if(Number.isFinite(s.currentIndex)) currentIndex = Math.max(0,s.currentIndex);
    if(s.rate) els.rate.value = s.rate;
    if(s.pitch) els.pitch.value = s.pitch;
    if(typeof s.skipUrls === "boolean") els.skipUrls.checked = s.skipUrls;
    if(s.config) appConfig = mergeConfig(window.RIO_DEFAULT_CONFIG, s.config);
    if (!s.copyVersion || s.copyVersion < 3) {
      for (const key of Object.keys(LEGACY_LINES)) {
        if ((appConfig.lines[key] === LEGACY_LINES[key] || appConfig.lines[key] === PREVIOUS_LINES[key])) appConfig.lines[key] = window.RIO_DEFAULT_CONFIG.lines[key];
      }
    }
    return s.voiceURI || "";
  }catch{ return ""; }
}

// Remove only speech decorations; preserve the editor and exported source text.
function stripEmojiAndFaces(text){
  let s = text
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, " ")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu, " ")
    .replace(/[\u200D\uFE0E\uFE0F\u{E0020}-\u{E007F}]/gu, "");
  // Parenthesized faces may include arms. Ordinary Japanese notes and formulae stay intact.
  s = s.replace(/[¯_＿＼／\\ヽヾ٩୧┐┌╰╮ᕦᕤm]*[（(][^()（）\r\n]{1,60}[)）][¯_＿＼ノﾉヾゞ／/\\ง۶وづっつ╯╰┘└m]*/gu, face => {
    const inside = face.slice(Math.max(face.indexOf('('), face.indexOf('（')) + 1).replace(/[)）].*$/u, '');
    if (/^(?:笑|泣|汗|涙|苦笑|爆笑|ツ)$/u.test(inside.trim())) return ' ';
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(inside.replace(/[ノツシロ口ハヘホミ彡メ乂乁八ゝゞッっつづ]/gu, ''))) return face;
    if (/[a-zA-Z]/u.test(inside.replace(/[oOTtQqXxwWvVDPpmつ]/g, ''))) return face;
    // 日付・時刻・式（2026/08/12、11:14:46、3-2 など）は顔文字として扱わない
    if (/[0-9０-９]{2,}|[0-9０-９]\s*[:：\/／.．\-－]\s*[0-9０-９]/u.test(inside)) return face;
    const facial = /[ωДд∀▽△∇益皿дᴗᗜᵕᵔᵒ•ಠಥರ눈╥╯╰]/u.test(inside)
      || /[\^＾;；:：TＴQＱ><＞＜ﾟ゜°´｀・･￣─－-].{0,14}[\^＾;；:：TＴQＱ><＞＜ﾟ゜°´｀・･￣─－-]/u.test(inside)
      || /^[\s_*＊.。oOｍm]+$/u.test(inside) && /[_＿]/u.test(inside);
    return facial ? ' ' : face;
  });
  s = s.replace(/(^|[^A-Za-z0-9])(?:[:;=8xX][-^']?[)DＰPp(\/\\]|[)D(][-^']?[:;=]|[TQxX^＾>＞][_.＿oＯ-][TQxX^＾<＜]|[oO][_.][oO])(?=$|[^A-Za-z0-9])/gu,'$1 ');
  return s;
}

function normalizeForSpeech(input){
  const exact = new Set(appConfig.skipExactLines.map(s=>s.trim()));
  const contains = appConfig.skipContains.filter(Boolean);

  return input.split(/\r?\n/).map(line=>{
    let s = line.trimEnd();
    const trimmed = s.trim();

    if(exact.has(trimmed)) return "";
    if(contains.some(token => token && s.includes(token))) return "";
    if(/^\s*-{3,}\s*$/.test(s)) return "";
    if(/^\s*⋱♱⋰(?:\s+⋱♱⋰)*\s*$/.test(s)) return "";
    if(/^\s*[─━═]{3,}\s*$/.test(s)) return "";
    if(/^\s*```/.test(s)) return "";

    s = stripEmojiAndFaces(s);

    if(appConfig.stripMarkdown){
      s = s
        .replace(/^\s{0,3}#{1,6}\s*/,"")
        .replace(/^\s*[-*+]\s+/,"")
        .replace(/^\s*\d+[.)]\s+/,"")
        .replace(/^\s*>\s?/,"")
        .replace(/\*\*/g,"")
        .replace(/__/g,"")
        .replace(/~~/g,"")
        .replace(/`/g,"")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1");
    }

    if(els.skipUrls.checked) s = s.replace(/https?:\/\/\S+/g,"");
    if(s.includes("|")) s = s.replace(/\s*\|\s*/g,"、").replace(/^、|、$/g,"");
    s = s.replace(/[◆◇■□●○★☆※✧✦♡♥♪♫♬]+/g," ");
    s = s.replace(/[ \t]+/g," ").trim();
    return s;
  }).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}

function splitChunks(text){
  const clean = normalizeForSpeech(text);
  if(!clean) return [];
  const rough = clean.split(/(?<=[。！？!?])\s+|\n+/);
  const out = [];

  for(let part of rough){
    part = part.trim();
    if(!part) continue;
    while(part.length > 220){
      let cut = 220;
      for(const mark of ["、","，",",","；",";", "：",":"]){
        const p = part.lastIndexOf(mark,220);
        if(p >= 90){ cut = p+1; break; }
      }
      out.push(part.slice(0,cut).trim());
      part = part.slice(cut).trim();
    }
    if(part) out.push(part);
  }
  return out;
}

function prepare(force=false){
  const raw = els.text.value;
  if(force || raw !== lastPreparedText){
    chunks = splitChunks(raw);
    lastPreparedText = raw;
    if(currentIndex >= chunks.length) currentIndex = 0;
  }
  updateMeta();
  saveState();
  return chunks.length > 0;
}

function updateMeta(){
  const total = chunks.length;
  const shown = total ? Math.min(currentIndex+1,total) : 0;
  els.progressBig.textContent = `${shown} / ${total}`;
  els.charCount.textContent = `${els.text.value.length.toLocaleString()}文字`;
  els.chunkCount.textContent = `${total.toLocaleString()}文`;
  const charsPerMin = 320 * Math.max(Number(els.rate.value), .1);
  const minutes = Math.ceil(normalizeForSpeech(els.text.value).length / charsPerMin);
  els.estimate.textContent = `推定 ${Number.isFinite(minutes) ? minutes : 0}分`;
  els.progressSmall.textContent = total ? `読み上げ位置 ${shown} / ${total}` : "準備完了";
}

function selectedVoice(){
  return voices.find(v=>v.voiceURI===els.voice.value) || null;
}

function speakCurrent(){
  if(!supported || !chunks.length || currentIndex >= chunks.length){
    if(chunks.length && currentIndex >= chunks.length) finish();
    return;
  }
  const token = sessionToken;
  const utter = new SpeechSynthesisUtterance(chunks[currentIndex]);
  const v = selectedVoice();
  if(v) utter.voice = v;
  utter.rate = Number(els.rate.value);
  utter.pitch = Number(els.pitch.value);

  utter.onstart = ()=>{
    if(token !== sessionToken) return;
    els.now.textContent = chunks[currentIndex];
    els.rio.textContent = appConfig.lines.play;
    updateMeta();
  };
  utter.onend = ()=>{
    if(token !== sessionToken) return;
    currentIndex++;
    saveState();
    updateMeta();
    if(currentIndex >= chunks.length) finish();
    else setTimeout(()=>{ if(token===sessionToken) speakCurrent(); },80);
  };
  utter.onerror = e=>{
    if(token !== sessionToken) return;
    if(["canceled","interrupted"].includes(e.error)) return;
    els.rio.textContent = appConfig.lines.error;
    els.now.textContent = "読み上げエラー: " + (e.error || "unknown");
  };

  synth.speak(utter);
}

function play(){
  if(!supported) return;
  if(!prepare(false)){
    els.rio.textContent = appConfig.lines.empty;
    els.now.textContent = "文章が空です。";
    return;
  }
  sessionToken++;
  synth.cancel();
  if(currentIndex >= chunks.length) currentIndex = 0;
  setTimeout(speakCurrent,70);
}

function pause(){
  if(!supported) return;
  sessionToken++;
  synth.cancel();
  els.rio.textContent = appConfig.lines.pause;
  els.now.textContent = chunks[currentIndex] || "一時停止中";
  saveState();
}

function stop(){
  if(!supported) return;
  sessionToken++;
  synth.cancel();
  currentIndex = 0;
  updateMeta();
  saveState();
  els.now.textContent = "先頭に戻りました。ここから読み直せますわ。";
  els.rio.textContent = appConfig.lines.ready;
}

function move(delta){
  if(!prepare(false)) return;
  sessionToken++;
  synth.cancel();
  currentIndex = Math.min(Math.max(currentIndex+delta,0),chunks.length-1);
  updateMeta();
  saveState();
  els.now.textContent = chunks[currentIndex] || "";
}

function finish(){
  currentIndex = chunks.length;
  updateMeta();
  saveState();
  els.rio.textContent = appConfig.lines.finish;
  els.now.textContent = "読み上げ完了。";
}

function populateVoices(preferredURI=""){
  if(!supported) return;
  voices = synth.getVoices().slice().sort((a,b)=>{
    const jaA=/^ja(-|_)/i.test(a.lang)?0:1, jaB=/^ja(-|_)/i.test(b.lang)?0:1;
    return jaA-jaB || a.name.localeCompare(b.name,"ja");
  });
  const current = preferredURI || els.voice.value;
  els.voice.innerHTML = "";
  if(!voices.length){
    const opt=document.createElement("option");
    opt.textContent="音声を取得中…";
    els.voice.appendChild(opt);
    return;
  }
  for(const v of voices){
    const opt=document.createElement("option");
    opt.value=v.voiceURI;
    opt.textContent=`${v.name} — ${v.lang}${v.default?"（既定）":""}`;
    els.voice.appendChild(opt);
  }
  if(voices.some(v=>v.voiceURI===current)) els.voice.value=current;
  else{
    const ja=voices.find(v=>/^ja(-|_)/i.test(v.lang));
    if(ja) els.voice.value=ja.voiceURI;
  }
}

async function pasteClipboard(){
  try{
    if(navigator.clipboard && window.isSecureContext){
      const txt=await navigator.clipboard.readText();
      if(txt){
        els.text.value=txt; currentIndex=0; prepare(true); return;
      }
    }
    els.text.focus();
    els.rio.textContent="自動貼り付けが使えないようです。入力欄に直接貼り付けてください。";
  }catch{
    els.text.focus();
    els.rio.textContent="貼り付けの許可がないようですわ。入力欄に直接貼り付けてください。";
  }
}

function openFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    els.text.value=String(reader.result||"");
    currentIndex=0;
    prepare(true);
  };
  reader.readAsText(file,"utf-8");
}

function saveText(){
  const blob=new Blob([els.text.value],{type:"text/plain;charset=utf-8"});
  downloadBlob(blob,"彼岸リオReader_テキスト.txt");
}

// claude.aiで公開したページでは保存確認つきの downloads 機能を使い、それ以外では通常のダウンロードを行う
async function downloadBlob(blob, filename){
  if(window.claude && typeof window.claude.use === "function"){
    try{
      const downloads = await window.claude.use("downloads");
      if(downloads){
        await downloads.save({filename, data:blob});
        return;
      }
    }catch(e){
      if(e && e.code === "declined") return;
      els.rio.textContent = "ファイルを保存できませんでした。時間をおいて、もう一度お試しください。";
      return;
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ブラウザ標準の確認ダイアログが使えない環境でも動く、ページ内の確認ダイアログ
function askConfirm(message, okLabel){
  const dlg=$("confirmDialog");
  if(!dlg || typeof dlg.showModal!=="function") return Promise.resolve(window.confirm(message));
  $("confirmMessage").textContent=message;
  $("confirmOk").textContent=okLabel||"はい";
  return new Promise(resolve=>{
    const done=v=>{ $("confirmOk").onclick=null; $("confirmCancel").onclick=null; dlg.onclose=null; if(dlg.open) dlg.close(); resolve(v); };
    $("confirmOk").onclick=()=>done(true);
    $("confirmCancel").onclick=()=>done(false);
    dlg.onclose=()=>done(false);
    dlg.showModal();
  });
}

function showPreview(){
  els.previewBody.textContent=normalizeForSpeech(els.text.value)||"（空です）";
  if(typeof els.previewDialog.showModal==="function") els.previewDialog.showModal();
}

function openSettings(){
  els.skipExactInput.value=appConfig.skipExactLines.join("\n");
  els.skipContainsInput.value=appConfig.skipContains.join("\n");
  els.displayNameInput.value=appConfig.displayName;
  els.readyLineInput.value=appConfig.lines.ready;
  els.playLineInput.value=appConfig.lines.play;
  els.pauseLineInput.value=appConfig.lines.pause;
  els.finishLineInput.value=appConfig.lines.finish;
  $("emptyLineInput").value=appConfig.lines.empty;
  $("errorLineInput").value=appConfig.lines.error;
  els.settingsDialog.showModal();
}

function saveSettingsFromForm(){
  appConfig.skipExactLines=els.skipExactInput.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  appConfig.skipContains=els.skipContainsInput.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  appConfig.displayName=els.displayNameInput.value.trim() || window.RIO_DEFAULT_CONFIG.displayName;
  appConfig.lines.ready=els.readyLineInput.value.trim() || window.RIO_DEFAULT_CONFIG.lines.ready;
  appConfig.lines.play=els.playLineInput.value.trim() || window.RIO_DEFAULT_CONFIG.lines.play;
  appConfig.lines.pause=els.pauseLineInput.value.trim() || window.RIO_DEFAULT_CONFIG.lines.pause;
  appConfig.lines.finish=els.finishLineInput.value.trim() || window.RIO_DEFAULT_CONFIG.lines.finish;
  appConfig.lines.empty=$("emptyLineInput").value.trim() || window.RIO_DEFAULT_CONFIG.lines.empty;
  appConfig.lines.error=$("errorLineInput").value.trim() || window.RIO_DEFAULT_CONFIG.lines.error;
  els.rio.textContent=appConfig.lines.ready;
  $("rioSpeaker").textContent=appConfig.displayName;
  window.RioAppearance.apply(appConfig.appearance,appConfig.displayName);
  currentIndex=0;
  prepare(true);
  els.settingsDialog.close();
}

async function restoreDefaults(){
  if(!await askConfirm("読み飛ばし規則とリオの表示設定を初期状態に戻しますか？ 入力した文章は残ります。","初期設定へ戻す")) return;
  const appearance=appConfig.appearance;
  appConfig=deepClone(window.RIO_DEFAULT_CONFIG);
  appConfig.appearance=appearance;
  openSettings();
  els.rio.textContent=appConfig.lines.ready;
  $("rioSpeaker").textContent=appConfig.displayName;
  window.RioAppearance.apply(appConfig.appearance,appConfig.displayName);
  prepare(true);
}

function exportSettings(){
  const payload={
    format:"HiganRioReaderSettings",
    version:1,
    exportedAt:new Date().toISOString(),
    config:appConfig
  };
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),"彼岸リオReader_設定.json");
}

function importSettings(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(String(reader.result||"{}"));
      const cfg=obj.config || obj;
      appConfig=mergeConfig(window.RIO_DEFAULT_CONFIG,cfg);
      currentIndex=0;
      prepare(true);
      els.rio.textContent=appConfig.lines.ready;
  $("rioSpeaker").textContent=appConfig.displayName;
  window.RioAppearance.apply(appConfig.appearance,appConfig.displayName);
      els.now.textContent="設定を読み込みました。";
    }catch{
      els.now.textContent="設定ファイルを読み込めませんでした。Readerから書き出したJSONファイルを選んでください。";
    }
  };
  reader.readAsText(file,"utf-8");
}

async function resetSaved(){
  if(!await askConfirm("このブラウザに保存した文章・再生位置・設定を削除しますか？ 必要な文章と設定は、先に書き出してください。","削除する")) return;
  sessionToken++;
  if(supported) synth.cancel();
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
  appConfig=deepClone(window.RIO_DEFAULT_CONFIG);
  els.text.value=""; currentIndex=0; chunks=[]; lastPreparedText="";
  updateMeta();
  els.now.textContent="保存状態をリセットしました。新しい文章をお待ちしていますわ。";
  els.rio.textContent=appConfig.lines.ready;
  $("rioSpeaker").textContent=appConfig.displayName;
  window.RioAppearance.apply(appConfig.appearance,appConfig.displayName);
}

const savedVoice=loadState();
els.rateLabel.textContent=Number(els.rate.value).toFixed(2)+"×";
els.pitchLabel.textContent=Number(els.pitch.value).toFixed(2);
els.rio.textContent=appConfig.lines.ready;
  $("rioSpeaker").textContent=appConfig.displayName;
  window.RioAppearance.apply(appConfig.appearance,appConfig.displayName);

if(!supported){
  els.badge.textContent="音声合成非対応";
  [els.play,els.pause,els.stop].forEach(b=>b.disabled=true);
}else{
  populateVoices(savedVoice);
  if("onvoiceschanged" in synth) synth.addEventListener("voiceschanged",()=>populateVoices(savedVoice));
  setTimeout(()=>populateVoices(savedVoice),500);
  setTimeout(()=>populateVoices(savedVoice),1500);
}

prepare(true);
// 保存済みの本文がある場合は、再開位置の文を表示する（初期案内のまま残らないように）
if(chunks.length) els.now.textContent = chunks[currentIndex] || "";

els.paste.addEventListener("click",pasteClipboard);
els.open.addEventListener("click",()=>els.file.click());
els.file.addEventListener("change",()=>openFile(els.file.files[0]));
els.save.addEventListener("click",saveText);
els.preview.addEventListener("click",showPreview);
els.play.addEventListener("click",play);
els.pause.addEventListener("click",pause);
els.stop.addEventListener("click",stop);
els.prev.addEventListener("click",()=>move(-1));
els.next.addEventListener("click",()=>move(1));
els.rate.addEventListener("input",()=>{els.rateLabel.textContent=Number(els.rate.value).toFixed(2)+"×"; updateMeta(); saveState();});
els.pitch.addEventListener("input",()=>{els.pitchLabel.textContent=Number(els.pitch.value).toFixed(2); saveState();});
els.voice.addEventListener("change",saveState);
els.skipUrls.addEventListener("change",()=>{currentIndex=0; prepare(true);});
els.text.addEventListener("input",()=>{
  currentIndex=0; lastPreparedText=""; chunks=splitChunks(els.text.value); updateMeta();
  clearTimeout(window.__rioSaveTimer); window.__rioSaveTimer=setTimeout(saveState,350);
});
window.RioAppearance.init(appearance=>{
  const previous=appConfig.appearance;
  appConfig.appearance=appearance;
  if(!saveState()){appConfig.appearance=previous;return false;}
  window.RioAppearance.apply(appearance,appConfig.displayName);
  return true;
});
$("appearanceBtn").addEventListener("click",()=>window.RioAppearance.open(appConfig.appearance));
els.settingsBtn.addEventListener("click",openSettings);
els.saveSettingsBtn.addEventListener("click",saveSettingsFromForm);
els.restoreDefaultsBtn.addEventListener("click",restoreDefaults);
els.exportSettingsBtn.addEventListener("click",exportSettings);
els.importSettingsBtn.addEventListener("click",()=>els.settingsFileInput.click());
els.settingsFileInput.addEventListener("change",()=>{importSettings(els.settingsFileInput.files[0]); els.settingsFileInput.value="";});
els.reset.addEventListener("click",resetSaved);

document.querySelectorAll("[data-close]").forEach(btn=>{
  btn.addEventListener("click",()=>$(btn.dataset.close).close());
});

window.addEventListener("beforeunload",()=>{saveState(); if(supported) synth.cancel();});

if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
})();


