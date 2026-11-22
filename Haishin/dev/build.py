"""編集用のHTML・CSS・JSから単体配布用HTMLを生成する。外部パッケージ不要。

- <script src="js/xxx.js"> はそのファイルを埋め込む（先頭の説明コメントは除く）。
- <script src="js/dir/"> はフォルダ内の .js をファイル名順につなげて埋め込む。
  data-wrap="iife" があれば (()=>{ 'use strict'; ... })(); で包む（映像側は一つの関数の中で変数を共有するため）。
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'

HEADER = re.compile(r"^((?:'use strict';\s*)?)/\*.*?\*/\s*", re.S)

def read_one(p):
    """各ファイル先頭の説明コメントは編集用。配布用HTMLには入れない。"""
    return HEADER.sub(r'\1', p.read_text(encoding='utf-8'), count=1)

# 分けたページ。index.html は全部入り（これまでどおり）。
# obs.html：配信（OBS）用。収録（動画・テイク）・AI観客席・ボイス録りを外す。
# rec.html：収録（動画・音声）用。歌枠ノート・歌枠管理シート・伴奏・掛け合い・AI観客席・ボイス録りを外す。
# 外したファイルのうち、ほかのファイルから呼ばれる関数・値だけ、何もしない代わり（stub）を置く。
# 保存データを点検する関数（sanitize から呼ぶもの）は外さない（外すと、そのページで保存したときにデータが消えるため）。
NOOP = lambda names: '\n'.join('function %s(){}' % n for n in names)
TARGETS = {
    'index.html': None,
    'obs.html': {
        'exclude': ['js/audio/06-takes.js', 'js/visual/15-audience.js', 'js/visual/16-voicerec.js',
                    'js/visual/61-capture.js', 'js/visual/62-videos.js'],
        'stub_audio': 'async function loadTakes(){return []}\nasync function renderTakes(){}',
        'stub_visual': NOOP(['audClear', 'audEvent', 'audShow', 'drawAudience', 'renderAud', 'renderVoiceRec', 'renderStoredVideos']) + '\nconst audOn=[];',
    },
    'rec.html': {
        'exclude': ['js/visual/10-karaoke.js', 'js/visual/11-songbook.js', 'js/visual/11g-songdest.js', 'js/visual/19-sheet.js',
                    'js/visual/19s-sheet-edit.js', 'js/visual/15-audience.js', 'js/visual/16-voicerec.js',
                    'js/visual/23-kakeai.js'],
        'stub_audio': '',
        'stub_visual': NOOP(['audClear', 'audEvent', 'audShow', 'drawAudience', 'renderAud', 'renderVoiceRec',
                             'renderKara', 'drawSetlist', 'renderSongs', 'sing', 'renderKk']) + '\nconst audOn=[];',
    },
}

def read_js(rel, target=None):
    p = SOURCE / rel
    if rel.endswith('/'):
        ex = set(target['exclude']) if target else set()
        files = [x for x in sorted(p.iterdir()) if x.suffix == '.js' and (rel + x.name) not in ex]
        code = '\n'.join(read_one(x) for x in files)
        if target:
            code += '\n' + (target['stub_audio'] if 'audio' in rel else target['stub_visual'])
        return code
    return read_one(p)

def build_one(name, target):
    text = (SOURCE / 'index.html').read_text(encoding='utf-8')
    def script(m):
        code = read_js(m.group(1), target)
        if m.group(2):
            code = "(()=>{\n'use strict';\n" + code + "\n})();"
        if re.search(r'</script', code, re.I):
            raise ValueError('スクリプト終端のエスケープが必要: ' + m.group(1))
        return '<script>\n' + code + '\n</script>'
    def css(m):
        return '<style>\n' + (SOURCE / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
    text = re.sub(r'<script src="([^"]+)"( data-wrap="iife")?></script>', script, text)
    text = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, text)
    if target:
        t = name.split('.')[0]
        text = text.replace('<script>\n', '<script>\nconst OTONOHA_BUILD_TARGET=%r;\n' % t, 1)
        title = {'obs': '配信（OBS）', 'rec': '収録'}[t]
        text = re.sub(r'<title>([^<]*)</title>', lambda m: '<title>%s｜%s</title>' % (m.group(1), title), text, count=1)
    (ROOT / name).write_text(text, encoding='utf-8')
    print('%s を生成しました（%.2f MB）。' % (name, len(text.encode('utf-8')) / 1048576))

def build():
    for name, target in TARGETS.items():
        build_one(name, target)
    # 秋・冬の演出の絵は、選んだときだけ読み込むので、index.html の隣に別のファイルとして置く
    (ROOT / 'autumn-art.json').write_bytes((SOURCE / 'autumn-art.json').read_bytes())

if __name__ == '__main__':
    build()
