from pathlib import Path
import json
import shutil
import subprocess
import time
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ASSETS = HERE / 'assets'
ASSETS.mkdir(exist_ok=True)
INPUTS = [
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-2ea4366e-1e33-43ba-a7ef-4c16c5780651.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-d1bb35d6-f756-432e-8b6e-0e8e8089bbbd.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-1649e125-47ba-47fc-a52d-d31e2c7e74ea.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-92c9439d-39ad-4271-8d2e-1114ccea4e9f.png',
]
for index, original in enumerate(INPUTS, 1):
    target = ASSETS / f'source_{index}.png'
    if not target.exists():
        shutil.copy2(original, target)
icon = ASSETS / 'icon.png'
if not icon.exists():
    shutil.copy2(r'C:\antigravity\浏览器标签页插件\tabpilot\store-assets\store_icon_300x300.png', icon)

CROPS = {
    'grouping.png': (1, (1307, 80, 1692, 520)),
    'grouping_success.png': (3, (1315, 384, 1684, 414)),
    'cleanup_review.png': (2, (1307, 80, 1692, 378)),
    'cleanup_actions.png': (2, (1307, 611, 1692, 656)),
    'agent.png': (4, (1307, 80, 1692, 656)),
}
for name, (index, bounds) in CROPS.items():
    with Image.open(ASSETS / f'source_{index}.png') as image:
        image.crop(bounds).save(ASSETS / name)

CSS = (HERE / 'design.css').read_text(encoding='utf-8')

def base(number, accent, wash, body):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TabSweep AI · {number}</title><style>{CSS}</style></head><body><div class="page" style="--accent:{accent};--wash:{wash}"><div class="brand"><img src="assets/icon.png"><strong>TabSweep AI</strong></div><div class="page-number">0{number} / 04</div>{body}</div></body></html>'''

PAGES = {
    'promo_1_grouping_en_1280x800': base(1, '#237ec7', '#dbeeff', '''
      <div class="copy"><div class="eyebrow">SMART GROUPING</div><h1>More tabs.<br>Less clutter.</h1><p class="subtitle">Group related tabs in one click.<br>Stay organized across every window.</p><div class="chips"><div class="chip">Native tab groups</div><div class="chip">Multiple windows</div></div></div>
      <div class="stage"></div><div class="group-tabs"><span class="group-tab" style="color:#2583d5;border-color:#d6e8fb">Dev</span><span class="group-tab" style="color:#9265c0;border-color:#e5d9f2">Research</span><span class="group-tab" style="color:#398c68;border-color:#d1e8dd">Work</span><span class="group-tab" style="color:#bd8126;border-color:#f0e1c6">Reading</span><span class="group-tab" style="color:#bb619a;border-color:#efd6e7">Media</span></div>
      <div class="ui group-ui"><img src="assets/grouping.png"></div><div class="ui success-ui"><img src="assets/grouping_success.png"></div>
      <div class="bottom-note price-inline"><b style="font-size:24px">≈ CN¥0.005 / sweep</b><span>DeepSeek V4.1 Flash<br>Estimated cost per sweep</span></div>'''),
    'promo_2_cleanup_en_1280x800': base(2, '#d16b60', '#f5e9e8', '''
      <div class="copy"><div class="eyebrow">SMART CLEANUP</div><h1>Review first.<br>Then clean up.</h1><p class="subtitle">Spot duplicates and error pages.<br>See the reason before you close.</p><div class="chips"><div class="chip">Uncheck to keep</div><div class="chip">Pinned tabs protected</div></div></div>
      <div class="stage"></div><div class="ui cleanup-ui"><img src="assets/cleanup_review.png"></div><div class="confirm-label"><span class="dot">↓</span>Review your selection. Then confirm.</div><div class="ui cleanup-actions"><img src="assets/cleanup_actions.png"></div><div class="cleanup-foot">You decide what stays and what goes.</div>
      <div class="bottom-note">Every cleanup suggestion comes with a reason.</div>'''),
    'promo_3_agent_en_1280x800': base(3, '#8462be', '#e9e7fc', '''
      <div class="copy"><div class="eyebrow">CHAT-BASED ORGANIZING</div><h1>Tell it what<br>to organize.</h1><p class="subtitle">Manage tabs in plain English.<br>Save your preferences as lasting rules.</p><div class="chips"><div class="chip">Natural language</div><div class="chip">Saved custom rules</div></div></div>
      <div class="stage"></div><div class="ui agent-ui"><img src="assets/agent.png"></div><div class="prompt-label">Try a prompt · Example</div><div class="prompt">Group my development tabs,<br>and show me any duplicates.</div><div class="agent-note">Group tabs, review clutter,<br>and save your own rules.</div><div class="bottom-note">Make your tab manager work the way you do.</div>'''),
    'promo_4_privacy_en_1280x800': base(4, '#38836b', '#e4f2ed', '''
      <div class="copy"><div class="eyebrow">BRING YOUR OWN KEY · LOCAL STORAGE</div><h1 style="font-size:58px">Your key.<br>Your choice of AI.</h1><p class="subtitle">Store your key and rules in your browser.<br>Connect directly to the model you choose.</p><div class="chips"><div class="chip">Stored locally</div><div class="chip">No developer proxy</div></div></div>
      <div class="cost-card"><div class="cost-label">DeepSeek V4.1 Flash</div><div class="cost-amount">≈ CN¥0.005<span>/ sweep</span></div><div class="cost-caption">Estimated cost per sweep</div></div>
      <div class="stage"></div><div class="diagram-title">Direct from your browser</div>
      <div class="browser-card"><div class="browser-brand"><img src="assets/icon.png">TabSweep</div><div class="local-label">Stored in your browser</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-5-5 3-3m0 6 3-3"/></svg></span>API Key</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4"/></svg></span>Saved rules</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg></span>AI settings</div></div>
      <div class="arrow">Direct<svg viewBox="0 0 48 28"><path d="M3 14h39M33 6l9 8-9 8"/></svg></div>
      <div class="model-card"><div class="model-title">Your model</div><span class="model-chip primary">DeepSeek</span><span class="model-chip">OpenAI</span><span class="model-chip">Claude</span><span class="model-chip">Custom</span><div class="model-foot">Cloud or local models</div></div>
      <div class="direct-note"><b>Your API key stays in your browser</b><br>Requests go straight to your configured endpoint.</div><div class="data-note">Cloud models receive tab titles and URLs when you request AI organization.</div>'''),
}

CHROME = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
PROFILE = Path(r'C:\kaggle\Kaggriculture-博弈思路\scratch\tabsweep-promo-en-render-profile-20261004')
outputs = []
for stem, html in PAGES.items():
    page = HERE / f'{stem}.html'
    page.write_text(html, encoding='utf-8')
    output = ROOT / f'{stem}.png'
    if output.exists():
        output.unlink()
    cmd = [str(CHROME), '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1280,800', '--virtual-time-budget=1000', f'--user-data-dir={PROFILE}', f'--screenshot={output}', page.as_uri()]
    run = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=45)
    deadline = time.monotonic() + 20
    while not output.exists() and time.monotonic() < deadline:
        time.sleep(.2)
    if not output.exists():
        raise RuntimeError(f'Render failed: {stem}\n{run.stderr[-3000:]}')
    with Image.open(output) as image:
        if image.size != (1280, 800):
            raise RuntimeError(f'Wrong export dimensions: {image.size}')
    outputs.append(output.name)
    print(f'Rendered {output.name}', flush=True)

contact = Image.new('RGB', (1280, 852), '#eaf0f7')
draw = ImageDraw.Draw(contact)
font = ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf', 16)
for i, name in enumerate(outputs):
    x, y = (i % 2) * 640, (i // 2) * 426
    with Image.open(ROOT / name) as image:
        contact.paste(image.resize((640, 400), Image.Resampling.LANCZOS).convert('RGB'), (x, y + 26))
    draw.text((x + 18, y + 3), ['01 Smart grouping', '02 Smart cleanup', '03 Chat-based organizing', '04 Your key, your AI'][i], font=font, fill='#3c536e')
contact.save(ROOT / 'preview_4up_en.png')

manifest = {
    'project': 'TabSweep AI', 'locale': 'en', 'export_date': '2026-10-04', 'dimensions': [1280, 800], 'files': outputs,
    'source_screenshots': [{'file': f'source/assets/source_{i}.png', 'original': p} for i, p in enumerate(INPUTS, 1)],
    'crops': {k: {'source': v[0], 'bounds': v[1]} for k, v in CROPS.items()},
    'price_claim': {'model': 'DeepSeek V4.1 Flash', 'amount': 'Approximately CNY 0.005 per sweep', 'basis': 'User-verified price, unchanged currency; no exchange-rate conversion.'},
    'content_notes': ['Real English UI screenshots supplied by the user.', 'Agent prompt is explicitly marked as an example.', 'Privacy copy distinguishes local settings storage from cloud-model requests.'],
}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'README.md').write_text('''# TabSweep AI English store images\n\nFour PNGs, each 1280 x 800. `preview_4up_en.png` shows the complete set.\n\nThe layout matches the Chinese promotional set, with new English UI screenshots and adapted English marketing copy. Pricing remains in Chinese yuan, explicitly written as CN¥.\n\nSource HTML, CSS, screenshots, and the build script are in `source/`. Run `python source/build.py` to regenerate.\n''', encoding='utf-8')
print('All four English exports validated at 1280x800.', flush=True)
