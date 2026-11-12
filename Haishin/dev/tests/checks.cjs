'use strict';
// Focused regression checks. These execute isolated application functions, not microphone/browser APIs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const walk = require('internal/deps/acorn/acorn-walk/dist/walk');
const original = process.argv.includes('--original');
const originalBlocks = original ? [...fs.readFileSync(__dirname + '/../original/index-original.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]) : null;
const readDir = d => fs.readdirSync(d).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(d + '/' + f, 'utf8')).join('\n');
const audio = original ? originalBlocks[1] : readDir(__dirname + '/../source/js/audio');
const visual = original ? originalBlocks[2] : '(()=>{' + readDir(__dirname + '/../source/js/visual') + '})();';
const parse = code => acorn.parse(code, { ecmaVersion: 'latest' });
function find(code, type, name) {
  let result;
  walk.simple(parse(code), { [type](node) { if (node.id?.name === name) result = code.slice(node.start, node.end); } });
  assert.ok(result, `Declaration ${name} exists`);
  return result;
}
function variable(code, name) {
  let result;
  walk.simple(parse(code), { VariableDeclarator(node) { if (node.id.name === name) result = `var ${name}=${code.slice(node.init.start, node.init.end)};`; } });
  assert.ok(result, `Variable ${name} exists`);
  return result;
}
function visualContext() {
  const c = vm.createContext({ console });
  vm.runInContext(['defaults', 'CHAR_KEYS', 'CHAR_RANGES', 'STATE_FMT'].map(n => variable(visual, n)).join('\n') +
    ['migrateState', 'sanitize', 'sceneClean', 'cleanChar', 'aspectPosClean', 'fxPosClean', 'ensureProfiles', 'newCharId', 'curChar', 'curProfile', 'pickValues', 'profileSnap'].map(n => find(visual, 'FunctionDeclaration', n)).join('\n') +
    ';var state={...defaults};', c);
  return c;
}
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.message.slice(0,220)); }
}
(async () => {
  await test('All three JavaScript blocks parse', () => {
    parse(audio); parse(visual); parse(fs.readFileSync(__dirname + '/../source/js/theme.js', 'utf8'));
  });
  await test('Empty imported profile retains its generated character', () => {
    const c = visualContext();
    vm.runInContext("state={...defaults,profiles:[{id:'p1',name:'Test',chars:[],cur:''}],chars:{},profileId:'p1',charId:''};ensureProfiles();", c);
    assert.equal(vm.runInContext('!!curChar()', c), true);
    assert.equal(vm.runInContext('state.profiles[0].chars.length', c), 1);
  });
  await test('Duplicate character reference is repaired without a dangling profile', () => {
    const c = visualContext();
    vm.runInContext("state={...defaults,profiles:[{id:'p1',chars:['c1'],cur:'c1'},{id:'p2',chars:['c1'],cur:'c1'}],chars:{c1:cleanChar({})},profileId:'p2',charId:'c1'};ensureProfiles();", c);
    assert.equal(vm.runInContext('state.profiles.every(p=>p.chars.every(id=>!!state.chars[id]))', c), true);
  });
  await test('Motion settings survive sanitization', () => {
    const c = visualContext();
    assert.equal(vm.runInContext('sanitize({motionSing:37,motionSingSpeed:145,motionHop:12,motionShake:88}).motionSing', c), 37);
    assert.equal(vm.runInContext('sanitize({motionSingSpeed:145}).motionSingSpeed', c), 145);
  });
  await test('More than 200 valid characters survive reload sanitization', () => {
    const c = visualContext();
    assert.equal(vm.runInContext("Object.keys(sanitize({chars:Object.fromEntries(Array.from({length:250},(_,i)=>['c'+i,{}]))}).chars).length", c), 250);
  });
  await test('Null or array visual configuration is safely normalized', () => {
    const c = visualContext();
    assert.equal(vm.runInContext('sanitize(null).fps', c), 30);
    assert.equal(vm.runInContext('sanitize([]).fps', c), 30);
  });
  await test('State format 1 moves the video list out of settings without losing entries (and twice is harmless)', () => {
    const c = visualContext();
    vm.runInContext("var s1=migrateState({videos:[{id:'a1',name:'x.mp4'},{id:'b2'}]});var s2=migrateState(JSON.parse(JSON.stringify(s1)));", c);
    assert.equal(vm.runInContext('s1.fmt', c), 2);
    assert.equal(vm.runInContext('s1.videos', c), undefined);
    assert.equal(vm.runInContext('s1.legacyVideos.map(x=>x.id).join()', c), 'a1,b2');
    assert.equal(vm.runInContext('JSON.stringify(s1)===JSON.stringify(s2)', c), true);
  });
  await test('Imported settings never carry a video list; legacy rows keep their missing flag', () => {
    const c = visualContext();
    assert.equal(vm.runInContext("sanitize({videos:[{id:'zz'}]}).legacyVideos.length", c), 0);
    assert.equal(vm.runInContext("sanitize({videos:[{id:'zz'}]}).videos", c), undefined);
    assert.equal(vm.runInContext("sanitize({legacyVideos:[{id:'q1',missing:true}]}).legacyVideos[0].missing", c), true);
    assert.equal(vm.runInContext("sanitize({fmt:9}).fmt", c), 2);
  });
  await test('Settings file reader accepts only .live and rejects duplicate asset keys', async () => {
    const c = vm.createContext({ Blob, TextDecoder, Uint8Array, DataView, Set, Error });
    vm.runInContext("const LIVE_MAGIC='OTNHLIVE',LIVE_FORMAT='otonoha-live-pack';" + find(audio, 'FunctionDeclaration', 'readPackHeader'), c);
    const len = new Uint8Array(4), enc = o => new TextEncoder().encode(JSON.stringify(o));
    const dup = enc({ format: 'otonoha-live-pack', config: {}, studio: {}, assets: [
      { key: 'same', kind: 'audio', offset: 0, size: 1 }, { key: 'same', kind: 'audio', offset: 1, size: 1 }
    ] });
    new DataView(len.buffer).setUint32(0, dup.length, true);
    c.file = new Blob(['OTNHLIVE', len, dup, new Uint8Array(2)]);
    await assert.rejects(vm.runInContext('readPackHeader(file)', c), /重複/);
    const valid = enc({ format: 'otonoha-live-pack', config: {}, studio: {}, assets: [] });
    new DataView(len.buffer).setUint32(0, valid.length, true); c.file = new Blob(['OTNHLIVE', len, valid]);
    assert.ok((await vm.runInContext('readPackHeader(file)', c)).head.config);
    const kissa = enc({ format: 'meltune-kissa-pack', config: {}, assets: [] });
    new DataView(len.buffer).setUint32(0, kissa.length, true); c.file = new Blob(['MTKSPACK', len, kissa]);
    assert.equal(await vm.runInContext('readPackHeader(file)', c), null);
  });
  await test('Singing history is no longer cut at 5,000 entries and keeps the original time after an edit', () => {
    const c = visualContext();
    vm.runInContext("var big=sanitize({singLog:Array.from({length:6200},(_,i)=>({id:'x'+i,t:'2026-01-01T00:00:00.000Z',title:'曲'+i,sess:'s1',start:'2026-01-01T00:00:00.000Z',off:i,off0:i===3?1:undefined}))});", c);
    assert.equal(vm.runInContext('big.singLog.length', c), 6200);
    assert.equal(vm.runInContext('big.singLog[3].off0', c), 1);
    assert.equal(vm.runInContext("'off0' in big.singLog[4]", c), false);
  });
  await test('Stopping an audio recording keeps the microphone muted', async () => {
    const c = vm.createContext({ console, setTimeout });
    vm.runInContext(`
      var gainValue=-1, rec={state:'paused',take:{id:'t1',sampleRate:48000},mode:'script',retry:[],frames:48000,recovered:false};
      var cfg={rec:{fadeOnStop:false,micVolume:75}},ctx={currentTime:0},micMuted=true,bgmLow=false,bgmPlaying=null,rescue=null,lastTakeId=null;
      var micGain={gain:{cancelScheduledValues(){},setValueAtTime(v){gainValue=v;}}};
      function renderRecState(){} function renderSaveWarn(){} async function flushChunks(){} async function idbPut(){}
      async function renderTakes(){} function updateStorage(){} function toast(){} function fmtTime(){return ''}
      function releaseBoostHoldIfQuiet(){} function unsavedSec(){return 0} function errText(e){return e.message}
    ` + find(audio, 'FunctionDeclaration', 'stopRec'), c);
    await vm.runInContext('stopRec()', c);
    assert.equal(vm.runInContext('gainValue', c), 0);
  });
  await test('Audio recording startup prevents duplicate simultaneous starts', async () => {
    let resume;
    const gate = new Promise(r => { resume = r; });
    const c = vm.createContext({ console, navigator: {}, gate });
    vm.runInContext(`
      var rec={state:'idle',take:null}, calls=0,ctx={resume(){calls++;return gate;}};
      function audioEngine(){} function renderRecState(){} async function ensureRecorder(){}
      function micLive(){return false} async function enableMic(){} function toast(){}
    ` + find(audio, 'FunctionDeclaration', 'startRec'), c);
    const a = vm.runInContext('startRec()', c), b = vm.runInContext('startRec()', c);
    assert.equal(vm.runInContext('calls', c), 1);
    resume(); await Promise.all([a,b]);
    assert.equal(vm.runInContext('rec.state', c), 'idle');
  });
  await test('Settings file import refuses changes during capture', async () => {
    let handler;
    walk.simple(parse(audio), {AssignmentExpression(n){if(audio.slice(n.left.start,n.left.end)==="$('#importFile').onchange")handler=audio.slice(n.right.start,n.right.end);}});
    assert.ok(handler);
    const c=vm.createContext({console,readAttempt:false,notice:'',rec:{state:'recording'},videoJob:null,studioCapturing:false});
    vm.runInContext('function toast(s){notice=s};var handler='+handler,c);
    c.event={target:{files:[{name:'a.live',slice(){c.readAttempt=true;throw Error('must not read while recording')}}],value:'selected'}};
    await vm.runInContext('handler(event)',c);
    assert.equal(c.readAttempt,false);
    assert.match(c.notice,/終わってから/);
  });
  await test('Images are never mirrored or stretched (no negative or uneven canvas scale outside the built-in vector motifs)', () => {
    const bad = [];
    for (const [name, src] of [['audio', audio], ['visual', visual]]) {
      walk.simple(parse(src), { CallExpression(n) {
        const c = n.callee;
        if (c.type !== 'MemberExpression' || c.property.name !== 'scale' || n.arguments.length < 1) return;
        const obj = src.slice(c.object.start, c.object.end), args = n.arguments.map(a => src.slice(a.start, a.end));
        // p.scale は、効果音動画用の花びら・葉っぱの形（画像ではないベクター図形）を作る処理だけ
        if (obj === 'p') return;
        if (args.length !== 2 || args[0] !== args[1] || /^-/.test(args[0])) bad.push(name + ': ' + src.slice(n.start, n.end));
      } });
    }
    assert.deepEqual(bad, []);
  });
  console.log(JSON.stringify({ mode: original ? 'original' : 'revised', passed, failed }));
  process.exitCode = failed ? 1 : 0;
})();
