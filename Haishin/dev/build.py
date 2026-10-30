"""編集用のHTML・CSS・JSから単体配布用HTMLを生成する。外部パッケージ不要。"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'

def build():
    text = (SOURCE / 'index.html').read_text(encoding='utf-8')
    def script(match):
        path = SOURCE / match.group(1)
        code = path.read_text(encoding='utf-8')
        # HTML内のスクリプトを途中で閉じるリテラルがないことを検証。
        if re.search(r'</script', code, re.I):
            raise ValueError(f'スクリプト終端のエスケープが必要: {path}')
        return '<script>\n' + code + '\n</script>'
    def css(match):
        return '<style>\n' + (SOURCE / match.group(1)).read_text(encoding='utf-8') + '\n</style>'
    text = re.sub(r'<script src="([^"]+)"></script>', script, text)
    text = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, text)
    (ROOT / 'index.html').write_text(text, encoding='utf-8')
    print('index.html を生成しました。')

if __name__ == '__main__':
    build()
