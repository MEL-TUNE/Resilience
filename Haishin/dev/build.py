"""編集用のHTML・CSS・JSから単体配布用HTMLを生成する。外部パッケージ不要。

- <script src="js/xxx.js"> はそのファイルを埋め込む。
- <script src="js/dir/"> はフォルダ内の .js をファイル名順につなげて埋め込む。
  data-wrap="iife" があれば (()=>{ 'use strict'; ... })(); で包む（映像側は一つの関数の中で変数を共有するため）。
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'

def read_js(rel):
    p = SOURCE / rel
    if rel.endswith('/'):
        files = sorted(x for x in p.iterdir() if x.suffix == '.js')
        return '\n'.join(f'/* --- {x.name} --- */\n' + x.read_text(encoding='utf-8') for x in files)
    return p.read_text(encoding='utf-8')

def build():
    text = (SOURCE / 'index.html').read_text(encoding='utf-8')
    def script(m):
        code = read_js(m.group(1))
        if m.group(2):
            code = "(()=>{\n'use strict';\n" + code + "\n})();"
        if re.search(r'</script', code, re.I):
            raise ValueError('スクリプト終端のエスケープが必要: ' + m.group(1))
        return '<script>\n' + code + '\n</script>'
    def css(m):
        return '<style>\n' + (SOURCE / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
    text = re.sub(r'<script src="([^"]+)"( data-wrap="iife")?></script>', script, text)
    text = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, text)
    (ROOT / 'index.html').write_text(text, encoding='utf-8')
    print('index.html を生成しました。')

if __name__ == '__main__':
    build()
