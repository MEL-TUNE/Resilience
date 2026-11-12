// Apps Script の SpreadsheetApp を、試験に必要なぶんだけまねる
const fs = require('fs');
function mkSheet(name, rows, opt = {}) {
  const g = rows.map(r => r.slice());
  const sh = {
    name, g, fx: opt.fx || {}, calc: opt.calc || null, dv: opt.dv || {}, fmt: {}, maxCols: opt.maxCols || 26, maxRows: opt.maxRows || 1000,
    log: [],
    getName: () => name,
    getMaxRows: () => sh.maxRows,
    getMaxColumns: () => sh.maxCols,
    getLastRow: () => { for (let i = g.length - 1; i >= 0; i--) if ((g[i] || []).some(v => String(v ?? '') !== '')) return i + 1; return 0; },
    disp(r, c) { // 1始まり
      if (r === 1 && sh.fx[c]) return sh.fx[c].head;
      if (r > 1 && sh.fx[c] && !sh.fx[c].f) return '';
      if (r > 1 && sh.fx[c]) return sh.fx[c].f(sh, r);
      const v = (g[r - 1] || [])[c - 1];
      return v == null ? '' : String(v);
    },
    raw(r, c) { const v = (g[r - 1] || [])[c - 1]; return v == null ? '' : v; },
    set(r, c, v) {
      if (r === 1 && sh.fx[c]) throw Error('wrote header formula ' + name + c);
      if (r > 1 && sh.fx[c]) throw Error('WROTE INTO AUTO COLUMN ' + name + ' col ' + c + ' row ' + r);
      while (g.length < r) g.push([]);
      g[r - 1][c - 1] = v; sh.log.push([r, c, v]);
    },
    getDataRange() { const n = Math.max(sh.getLastRow(), 1); let w = 0; g.forEach(x => { w = Math.max(w, x.length); }); Object.keys(sh.fx).forEach(c => { w = Math.max(w, +c); }); return sh.getRange(1, 1, n, Math.max(w, 1)); },
    getRange(r, c, nr = 1, nc = 1) {
      const rg = {
        getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.disp(r + i, c + j))),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.raw(r + i, c + j))),
        getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (r + i === 1 && sh.fx[c + j]) ? '=formula' : '')),
        setValue: v => { sh.set(r, c, v); return rg; },
        setValues: vs => { vs.forEach((row, i) => row.forEach((v, j) => sh.set(r + i, c + j, v))); return rg; },
        setNumberFormat: f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.fmt[(r + i) + ':' + (c + j)] = f; return rg; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (g[r + i - 1]) g[r + i - 1][c + j - 1] = ''; return rg; },
        copyTo: (to, type) => { sh.log.push(['copy', r, type]); },
        getDataValidation: () => { const l = sh.dv[c]; return l ? { getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues: () => [l, true] } : null; },
        setFontWeight: () => rg, setFontColor: () => rg, setBackground: () => rg,
      };
      return rg;
    },
    insertRowBefore(r) { g.splice(r - 1, 0, []); sh.maxRows++; sh.log.push(['insertBefore', r]); },
    insertRowAfter(r) { g.splice(r, 0, []); sh.maxRows++; },
    insertColumnAfter() { sh.maxCols++; },
    setFrozenRows() { },
    hidden: false,
    copyTo(ss) { const c = mkSheet(name + '（写し）', g.map(r => r.slice()), { fx: sh.fx, dv: sh.dv, maxCols: sh.maxCols }); ss._add(c); return c; },
    setName(n) { sh._ss && sh._ss._rename(sh, n); sh.name = n; return sh; },
    hideSheet() { sh.hidden = true; return sh; },
  };
  return sh;
}
function mkGas(sheets) {
  const ss = {
    sheets, getName: () => '【試験用】歌枠管理シート', getId: () => 'TESTID',
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { const sh = mkSheet(n, []); sh._ss = ss; sheets[n] = sh; return sh; },
    getSpreadsheetTimeZone: () => 'Asia/Tokyo',
    _add(c) { c._ss = ss; sheets[c.name] = c; },
    _rename(sh, n) { for (const k of Object.keys(sheets)) if (sheets[k] === sh) delete sheets[k]; sheets[n] = sh; },
  };
  for (const sh of Object.values(sheets)) sh._ss = ss;
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() { }, CopyPasteType: { PASTE_FORMAT: 'F', PASTE_DATA_VALIDATION: 'DV' }, DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' } },
    LockService: { getDocumentLock: () => ({ waitLock() { }, releaseLock() { } }) },
    Utilities: { formatDate: (d) => '2026/11/12 18:' + String(d.getSeconds()).padStart(2, '0') + ':00' },
    ContentService: { createTextOutput: t => ({ setMimeType: () => t, t }), MimeType: { JSON: 'json' } },
  };
  const code = fs.readFileSync(process.env.GS || __dirname + '/../../otonoha-sheet.gs', 'utf8').replace("const OTONOHA_KEY = 'ここに合言葉';", "const OTONOHA_KEY = 'testkey123456';");
  const fn = new Function(...Object.keys(ctx), code + '\nreturn {handle_, doPost, doGet};');
  const api = fn(...Object.values(ctx));
  const call = p => JSON.parse(api.doPost({ postData: { contents: JSON.stringify({ key: 'testkey123456', ...p }) } }));
  return { ss, call, api };
}
module.exports = { mkSheet, mkGas };
