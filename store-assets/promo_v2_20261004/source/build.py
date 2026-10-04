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
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-2db3c738-1b26-4aa5-93f4-5d9870fb274a.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-a8535335-0758-48da-aa1c-46a4c0113dcf.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-c67d62d2-64e3-48a5-a5b6-7070d965c883.png',
    r'C:\Users\wu0\AppData\Local\Temp\codex-clipboard-8350a2ad-ca9a-426e-bf7e-4c3a8d940c33.png',
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
    'grouping_success.png': (4, (1315, 342, 1684, 373)),
    'cleanup_review.png': (3, (1307, 80, 1692, 334)),
    'cleanup_actions.png': (3, (1307, 611, 1692, 656)),
    'agent.png': (2, (1308, 80, 1693, 656)),
}
for name, (index, bounds) in CROPS.items():
    with Image.open(ASSETS / f'source_{index}.png') as image:
        image.crop(bounds).save(ASSETS / name)

CSS = r'''
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{font-family:'Microsoft YaHei','Segoe UI',sans-serif;color:#15243b;background:#f5f8fd}
.page{position:relative;width:1280px;height:800px;background:radial-gradient(ellipse at 89% 15%,var(--wash) 0,transparent 55%),radial-gradient(ellipse at 8% 97%,#e8eefb 0,transparent 46%);overflow:hidden}
.brand{position:absolute;left:64px;top:44px;display:flex;align-items:center;gap:12px}
.brand img{width:42px;height:42px;border-radius:11px}
.brand strong{font-family:'Segoe UI','Microsoft YaHei',sans-serif;font-size:23px;letter-spacing:-.5px;font-weight:750}
.page-number{position:absolute;right:65px;top:57px;font-size:14px;font-weight:600;letter-spacing:1px;color:#8191a8}
.copy{position:absolute;left:64px;top:164px;width:560px}
.eyebrow{display:flex;align-items:center;gap:9px;font-size:16px;color:var(--accent);font-weight:700;letter-spacing:1px}
.eyebrow:before{content:'';width:8px;height:8px;border-radius:50%;background:var(--accent)}
h1{font-size:59px;line-height:1.2;letter-spacing:-2px;margin:22px 0 0;font-weight:700}
.subtitle{font-size:22px;line-height:1.75;color:#586b82;margin:23px 0 0;font-weight:400}
.chips{display:flex;gap:10px;margin-top:28px;flex-wrap:wrap;width:550px}
.chip{display:flex;align-items:center;gap:8px;background:#ffffffc9;border:1px solid #dfe7f2;border-radius:11px;padding:12px 15px;font-size:16px;color:#334b67;font-weight:600;white-space:nowrap}
.chip:before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}
.stage{position:absolute;left:644px;top:113px;width:572px;height:628px;border-radius:32px;background:linear-gradient(145deg,#ffffffb3,#ffffff52);border:1px solid #ffffff;box-shadow:0 28px 75px -32px #6483a82a}
.ui{position:absolute;display:block;border:1px solid #dfe6ef;border-radius:14px;box-shadow:0 18px 45px -15px #536b8c42;overflow:hidden;background:#fff}
.ui img{display:block;width:100%;height:auto}
.bottom-note{position:absolute;left:64px;bottom:61px;color:#61748e;font-size:15px;line-height:1.65}
.price-inline{display:flex;align-items:center;gap:15px;border-top:1px solid #d9e3ef;padding-top:17px;width:495px}
.price-inline b{font-size:25px;color:#234b81;letter-spacing:-.6px;font-weight:700}
.price-inline span{font-size:14px;line-height:1.6;color:#627b97}
.group-tabs{position:absolute;left:682px;top:125px;width:499px;display:flex;gap:9px;justify-content:center}
.group-tab{font-size:15px;font-weight:600;padding:7px 12px;border-radius:9px;border:1px solid;background:#fff;white-space:nowrap}
.group-ui{left:710px;top:173px;width:458px}
.success-ui{left:710px;top:711px;width:458px;border-radius:10px;box-shadow:none;border-color:#d8eade}
.cleanup-ui{left:666px;top:158px;width:526px}
.confirm-label{position:absolute;left:669px;top:542px;display:flex;align-items:center;gap:13px;font-size:22px;font-weight:650;color:#2b435d}
.confirm-label .dot{display:flex;align-items:center;justify-content:center;width:31px;height:31px;border-radius:50%;background:#e8eff8;color:#5079a5;font-size:18px}
.cleanup-actions{left:666px;top:594px;width:526px;border-radius:12px}
.cleanup-foot{position:absolute;left:674px;top:686px;font-size:16px;color:#728197}
.agent-ui{left:797px;top:132px;width:399px}
.prompt-label{position:absolute;left:681px;top:302px;font-size:14px;font-weight:700;color:#765ab7;letter-spacing:.5px;background:#f2ebff;border:1px solid #e0d4f5;padding:8px 14px;border-radius:9px;z-index:3}
.prompt{position:absolute;left:681px;top:351px;width:473px;padding:29px 30px 31px;border-radius:18px;background:linear-gradient(135deg,#296fe9,#5263d6);box-shadow:0 16px 34px -12px #306ac369;font-size:26px;line-height:1.65;color:#fff;font-weight:550;z-index:3}
.prompt:after{content:'';position:absolute;right:20px;bottom:-10px;width:26px;height:26px;background:#4c65d9;transform:rotate(45deg);border-radius:4px;z-index:-1}
.agent-note{position:absolute;left:711px;top:543px;width:440px;font-size:16px;line-height:1.75;color:#63738a;z-index:3}
.diagram-title{position:absolute;left:678px;top:146px;font-size:22px;font-weight:650;color:#263e58}
.browser-card{position:absolute;left:680px;top:217px;width:222px;height:333px;padding:22px;border:1px solid #dce7f2;border-radius:20px;background:#fff;box-shadow:0 13px 28px -19px #41688760}
.browser-brand{display:flex;align-items:center;gap:10px;font:700 20px 'Segoe UI',sans-serif}
.browser-brand img{width:38px;height:38px;border-radius:10px}
.local-label{font-size:13px;color:#5682a8;background:#eef6fc;padding:6px 9px;border-radius:7px;display:inline-block;margin:19px 0 14px}
.storage-row{display:flex;align-items:center;gap:11px;margin-top:17px;font-size:18px;color:#304b66;font-weight:550}
.storage-icon{width:30px;height:30px;border-radius:8px;background:#edf5fd;display:flex;align-items:center;justify-content:center;color:#5185b9}
.storage-icon svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.model-card{position:absolute;left:970px;top:241px;width:211px;height:287px;padding:22px 20px;border:1px solid #dce7f2;border-radius:20px;background:#fff;box-shadow:0 13px 28px -19px #41688760}
.model-title{font-size:22px;font-weight:650;margin-bottom:19px;color:#304b66}
.model-chip{display:inline-block;padding:8px 10px;border-radius:8px;background:#f1f5fa;color:#4f647c;font-family:'Segoe UI','Microsoft YaHei',sans-serif;font-size:16px;font-weight:600;margin:0 5px 10px 0}
.model-chip.primary{background:#e7f2ff;color:#286fa8}
.model-foot{font-size:14px;color:#7890a8;margin-top:7px}
.arrow{position:absolute;left:914px;top:354px;width:48px;text-align:center;font-size:14px;font-weight:600;color:#5581aa}
.arrow svg{display:block;width:48px;height:28px;margin-top:10px;stroke:#669aca;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
.direct-note{position:absolute;left:680px;top:581px;width:501px;padding:18px 20px;border-radius:15px;background:#edf8f4;border:1px solid #d6eae1;color:#38735e;font-size:17px;line-height:1.65}
.direct-note b{font-size:18px;font-weight:650}
.data-note{position:absolute;left:680px;top:685px;width:500px;color:#718498;font-size:14px;line-height:1.6}
.cost-card{position:absolute;left:64px;top:583px;width:503px;height:150px;border:1px solid #d9e5ef;border-radius:18px;background:#ffffffd9;padding:20px 24px;box-shadow:0 13px 38px -25px #426c9960}
.cost-label{font-family:'Segoe UI','Microsoft YaHei',sans-serif;font-size:16px;font-weight:600;color:#627a92}
.cost-amount{font-size:46px;line-height:1.1;letter-spacing:-1.7px;font-weight:700;color:#245888;margin-top:10px}
.cost-amount span{font-size:17px;letter-spacing:0;font-weight:500;color:#69819a;margin-left:12px}
.cost-caption{font-size:13px;color:#8393a6;margin-top:10px}
'''

def base(number, accent, wash, body):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>TabSweep AI · {number}</title><style>{CSS}</style></head><body><div class="page" style="--accent:{accent};--wash:{wash}"><div class="brand"><img src="assets/icon.png"><strong>TabSweep AI</strong></div><div class="page-number">0{number} / 04</div>{body}</div></body></html>'''

PAGES = {
    'promo_1_grouping_1280x800': base(1, '#237ec7', '#dbeeff', '''
      <div class="copy"><div class="eyebrow">智能分组</div><h1>标签再多，<br>也能井井有条</h1><p class="subtitle">一键归入开发、AI、工作等彩色分组，<br>多个窗口也能统一管理。</p><div class="chips"><div class="chip">原生彩色标签组</div><div class="chip">多窗口统一管理</div></div></div>
      <div class="stage"></div><div class="group-tabs"><span class="group-tab" style="color:#2583d5;border-color:#d6e8fb">开发</span><span class="group-tab" style="color:#9265c0;border-color:#e5d9f2">AI</span><span class="group-tab" style="color:#398c68;border-color:#d1e8dd">工作</span><span class="group-tab" style="color:#bd8126;border-color:#f0e1c6">资讯</span><span class="group-tab" style="color:#bb619a;border-color:#efd6e7">影音</span></div>
      <div class="ui group-ui"><img src="assets/grouping.png"></div><div class="ui success-ui"><img src="assets/grouping_success.png"></div>
      <div class="bottom-note price-inline"><b>约 ¥0.005 / 次</b><span>DeepSeek V4.1 Flash<br>单次整理参考费用</span></div>'''),
    'promo_2_cleanup_1280x800': base(2, '#d16b60', '#f5e9e8', '''
      <div class="copy"><div class="eyebrow">智能清理</div><h1 style="font-size:55px">清理之前，<br>先看清楚再决定</h1><p class="subtitle">重复页、报错页、验证拦截页，<br>先给出理由，再由你确认。</p><div class="chips"><div class="chip">可逐项取消关闭</div><div class="chip">固定标签受保护</div></div></div>
      <div class="stage"></div><div class="ui cleanup-ui"><img src="assets/cleanup_review.png"></div><div class="confirm-label"><span class="dot">↓</span>逐项勾选，确认后执行</div><div class="ui cleanup-actions"><img src="assets/cleanup_actions.png"></div><div class="cleanup-foot">保留哪些、关闭哪些，由你决定。</div>
      <div class="bottom-note">每一条清理建议，都有可查看的理由。</div>'''),
    'promo_3_agent_1280x800': base(3, '#8462be', '#e9e7fc', '''
      <div class="copy"><div class="eyebrow">对话式整理</div><h1>把整理要求，<br>直接说出来</h1><p class="subtitle">像聊天一样管理浏览器标签，<br>也能保留你的长期整理规则。</p><div class="chips"><div class="chip">自然语言指令</div><div class="chip">自定义长期规则</div></div></div>
      <div class="stage"></div><div class="ui agent-ui"><img src="assets/agent.png"></div><div class="prompt-label">你可以这样说 · 指令示例</div><div class="prompt">把开发相关的标签放到一组，<br>重复页面先给我看看。</div><div class="agent-note">分组、清理、保存规则，<br>把你的要求直接交给 TabSweep。</div><div class="bottom-note">让整理规则贴合你的浏览习惯。</div>'''),
    'promo_4_privacy_1280x800': base(4, '#38836b', '#e4f2ed', '''
      <div class="copy"><div class="eyebrow">自带 API Key · 本地存储</div><h1>你的密钥，<br>你的模型选择</h1><p class="subtitle">密钥与规则保存在浏览器本地，<br>直接连接你选择的模型服务。</p><div class="chips"><div class="chip">浏览器本地存储</div><div class="chip">无开发者服务器中转</div></div></div>
      <div class="cost-card"><div class="cost-label">DeepSeek V4.1 Flash</div><div class="cost-amount">约 ¥0.005<span>/ 单次整理</span></div><div class="cost-caption">单次整理参考费用</div></div>
      <div class="stage"></div><div class="diagram-title">浏览器直连所选模型</div>
      <div class="browser-card"><div class="browser-brand"><img src="assets/icon.png">TabSweep</div><div class="local-label">留在浏览器本地</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-5-5 3-3m0 6 3-3"/></svg></span>API Key</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4"/></svg></span>自定义规则</div><div class="storage-row"><span class="storage-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg></span>模型设置</div></div>
      <div class="arrow">直连<svg viewBox="0 0 48 28"><path d="M3 14h39M33 6l9 8-9 8"/></svg></div>
      <div class="model-card"><div class="model-title">所选模型</div><span class="model-chip primary">DeepSeek</span><span class="model-chip">OpenAI</span><span class="model-chip">Claude</span><span class="model-chip">自定义</span><div class="model-foot">云端 / 本地模型</div></div>
      <div class="direct-note"><b>API Key 保存在本地</b><br>请求直接发到你配置的模型端点。</div><div class="data-note">使用云端模型时，会向所选服务发送标签标题和网址。</div>'''),
}

CHROME = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
PROFILE = Path(r'C:\kaggle\Kaggriculture-博弈思路\scratch\tabsweep-promo-render-profile-20261004')
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
font = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 16)
for i, name in enumerate(outputs):
    x, y = (i % 2) * 640, (i // 2) * 426
    with Image.open(ROOT / name) as image:
        contact.paste(image.resize((640, 400), Image.Resampling.LANCZOS).convert('RGB'), (x, y + 26))
    draw.text((x + 18, y + 3), ['01 智能分组', '02 智能清理', '03 对话式整理', '04 密钥与模型'][i], font=font, fill='#3c536e')
contact.save(ROOT / 'preview_4up.png')

manifest = {
    'project': 'TabSweep AI', 'export_date': '2026-10-04', 'dimensions': [1280, 800], 'files': outputs,
    'source_screenshots': [{'file': f'source/assets/source_{i}.png', 'original': p} for i, p in enumerate(INPUTS, 1)],
    'crops': {k: {'source': v[0], 'bounds': v[1]} for k, v in CROPS.items()},
    'price_claim': {'model': 'DeepSeek V4.1 Flash', 'amount': '约 ¥0.005 / 单次整理', 'basis': 'User verified; retained with model attribution and estimate wording.'},
    'content_notes': ['Actual supplied interface screenshots are cropped, not redrawn.', 'Agent callout is labelled as an instruction example; no successful execution is fabricated.', 'Local storage is described without claiming encryption or fully local cloud-model processing.'],
}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'README.md').write_text('''# TabSweep AI 宣传图 · 2026-10-04\n\n四张 PNG 均为 1280×800。preview_4up.png 为四图总览。\n\n- 01：智能分组，使用新分组截图及分组成功状态。\n- 02：智能清理，放大待关闭记录与确认按钮。\n- 03：对话式整理，真实界面配合明确标注的指令示例。\n- 04：密钥与模型，说明本地存储和模型直连。\n\n价格依用户核实结果保留，并注明 DeepSeek V4.1 Flash 与“约”的估算口径。\n\nsource/ 内保留 HTML、截图原始素材及构建脚本；运行 `python source/build.py` 可重新生成。\n''', encoding='utf-8')
print('All four exports validated at 1280x800.', flush=True)
