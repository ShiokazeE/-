#!/usr/bin/env python3
"""Apply a safe, targeted polish pass to ShiokazeE/-.

Run this script from the repository root (where index.html is located):
    python apply_polish.py
The script validates each expected source fragment before changing anything,
creates a timestamped backup, and rolls back if Node.js syntax checks fail.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path.cwd()
FILES = [Path("index.html"), Path("css/style.css"), Path("js/app.js"), Path("worker/worker.js")]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"Expected exactly one match for {label}; found {count}. No files have been changed.")
    return text.replace(old, new, 1)


def normalize(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def main() -> None:
    missing = [str(p) for p in FILES if not (ROOT / p).is_file()]
    if missing:
        fail("Run this script from your repository root. Missing: " + ", ".join(missing))

    originals = {p: (ROOT / p).read_text(encoding="utf-8") for p in FILES}
    newline = "\r\n" if "\r\n" in originals[Path("index.html")] else "\n"
    changed = {p: normalize(v) for p, v in originals.items()}
    html, css, js, worker = (changed[p] for p in FILES)

    # index.html: correct metadata path, add a visible theme control and use the existing Asuka asset.
    html = replace_once(
        html,
        '<meta name="theme-color" content="#eef0ee">\n<meta name="color-scheme" content="light">',
        '<meta name="theme-color" content="#0b0c0b">\n<meta name="color-scheme" content="light dark">',
        "theme metadata",
    )
    html = replace_once(
        html,
        '<meta property="og:image" content="https://shiokazee.github.io/bio/bg.jpg">',
        '<meta property="og:image" content="https://shiokazee.github.io/bio/assets/bg.jpg">\n<meta property="og:image:alt" content="Shiokaze — quiet digital interface">',
        "Open Graph image path",
    )
    html = replace_once(
        html,
        '          </span>\n        </div>\n\n        <img class="profile-avatar"',
        '          </span>\n          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Theme mode: automatic" title="Switch theme mode">AUTO</button>\n        </div>\n\n        <img class="profile-avatar"',
        "theme control markup",
    )
    html = replace_once(
        html,
        '<p id="track-meta">connecting to last.fm…</p>',
        '<p id="track-meta">connecting to listening feed…</p>',
        "music loading label",
    )
    html = replace_once(
        html,
        '<div class="feeds-side">\n            <span class="meta" id="feeds-meta">last.fm</span>',
        '<div class="feeds-side">\n            <span class="meta" id="feeds-meta">listenbrainz</span>',
        "initial music source label",
    )
    html = replace_once(
        html,
        '<figure class="char char-lucy" data-name="lucy">\n          <img src="assets/lucy.webp" alt="" aria-hidden="true">\n          <div class="char-slot" aria-hidden="true"><span>LUCY</span></div>\n        </figure>',
        '<figure class="char char-asuka" data-name="asuka" aria-hidden="true">\n          <img src="assets/asuka.webp" alt="" loading="lazy" decoding="async">\n        </figure>',
        "missing Lucy image replaced by existing Asuka asset",
    )
    html = html.replace(
        '<img src="assets/talia.webp" alt="" aria-hidden="true">',
        '<img src="assets/talia.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">',
    )

    # css/style.css: remove a broken status glyph and place Asuka over the card gap without a fake label.
    lines = css.splitlines()
    status_lines = [i for i, line in enumerate(lines) if ".dc-online:before{" in line]
    if len(status_lines) != 1:
        fail(f"Expected one Discord status pseudo-element; found {len(status_lines)}. No files have been changed.")
    lines[status_lines[0]] = '.dc-online:before{content:"· ";opacity:.5}'
    css = "\n".join(lines) + "\n"

    char_pattern = re.compile(r'/\* Люси.*?\.char-lucy \.char-slot span\{[^\n]*\}', re.DOTALL)
    if len(char_pattern.findall(css)) != 1:
        fail("Could not uniquely locate the old character layout. No files have been changed.")
    css = char_pattern.sub(
        '/* Asuka sits across the gap between the player and feed cards. */\n'
        '.char-asuka{top:-226px;right:5%;bottom:auto;width:250px;height:286px;z-index:1;overflow:visible}\n'
        '.char-asuka img{position:relative;z-index:1;object-fit:contain;object-position:bottom center;filter:drop-shadow(0 8px 14px rgba(24,28,34,.16))}\n'
        '.char-asuka .char-slot{display:none}', css, count=1)
    css = replace_once(css, '  .char-talia{width:150px;height:260px}',
                       '  .char-talia{width:150px;height:260px}\n  .char-asuka{right:2%;width:220px;height:270px;top:-214px}',
                       "medium-screen Asuka sizing")
    css = replace_once(css, '  .char-lucy{width:320px;height:180px;top:-164px}',
                       '  .char-asuka{width:218px;height:250px;top:-196px;right:3%}',
                       "short-screen Asuka sizing")
    css += '''

/* Final polish: consistent theme control, accessible focus and calm interactions. */
.profile-meta{display:flex;align-items:center;gap:6px;max-width:calc(100% - 20px)}
.theme-toggle{
  flex:none;padding:6px 8px;border:1px solid rgba(47,50,52,.12);border-radius:7px;
  background:rgba(248,249,247,.45);color:rgba(47,50,52,.64);
  font:600 8px/1 var(--mono);letter-spacing:.07em;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease;
}
.theme-toggle:hover{background:rgba(248,249,247,.78);border-color:rgba(47,50,52,.22);color:rgba(24,26,28,.9)}
.theme-toggle:active{transform:scale(.97)}
body.theme-dark .theme-toggle{background:rgba(20,22,24,.54);border-color:rgba(255,255,255,.14);color:rgba(230,232,230,.74)}
body.theme-dark .theme-toggle:hover{background:rgba(40,42,44,.78);color:rgba(245,246,245,.94)}
:where(a,button,input,textarea,[role="tab"]):focus-visible{outline:2px solid rgba(65,145,160,.8);outline-offset:3px}
button:disabled{opacity:.55;cursor:not-allowed}
@media (max-width:520px){
  .profile-meta{top:10px;right:10px;gap:4px}
  .meta-badge{gap:4px;padding:5px 6px;font-size:8px}
  .theme-toggle{padding:6px 7px;font-size:8px}
}
@media (prefers-reduced-motion:reduce){.theme-toggle{transition:none}.char-asuka img{filter:none}}
'''

    # js/app.js: theme preference survives refresh; AUTO follows day/night; terminal and button share one state.
    old_theme = '''  var manualTheme = null;
  function applyTimeTheme(){
    if(manualTheme === 'dark'){ body.classList.add('theme-dark'); return; }
    if(manualTheme === 'light'){ body.classList.remove('theme-dark'); return; }
    var h = new Date().getHours();
    var sat, bright, hue, tint, alpha;
    if(h >= 22 || h < 6){ sat = '.52'; bright = '.88'; hue = '-14deg'; tint = '30,40,60'; alpha = '.14'; }
    else if(h < 11){ sat = '.88'; bright = '1.06'; hue = '8deg'; tint = '255,240,220'; alpha = '.10'; }
    else if(h < 17){ sat = '.78'; bright = '1.015'; hue = '0deg'; tint = '255,255,255'; alpha = '.10'; }
    else { sat = '.72'; bright = '.96'; hue = '14deg'; tint = '255,225,190'; alpha = '.12'; }
    root.style.setProperty('--bg-saturate', sat);
    root.style.setProperty('--bg-brightness', bright);
    root.style.setProperty('--bg-hue', hue);
    root.style.setProperty('--tint-rgb', tint);
    root.style.setProperty('--tint-a', alpha);
  }
  applyTimeTheme();
  setInterval(applyTimeTheme, 60000);'''
    new_theme = '''  var manualTheme = null;
  try{
    var savedTheme = localStorage.getItem('shiokaze_theme');
    if(savedTheme === 'dark' || savedTheme === 'light') manualTheme = savedTheme;
  }catch(e){}
  var themeToggle = $('theme-toggle');

  function syncThemeToggle(){
    if(!themeToggle) return;
    var mode = manualTheme || 'auto';
    themeToggle.textContent = mode.toUpperCase();
    themeToggle.setAttribute('aria-label', 'Theme mode: ' + mode);
    themeToggle.title = 'Theme: ' + mode.toUpperCase() + ' · click to change';
  }

  function setThemeMode(mode){
    if(mode !== 'auto' && mode !== 'dark' && mode !== 'light') return;
    manualTheme = mode === 'auto' ? null : mode;
    try{ localStorage.setItem('shiokaze_theme', mode); }catch(e){}
    applyTimeTheme();
  }

  function applyTimeTheme(){
    var h = new Date().getHours();
    var sat, bright, hue, tint, alpha;
    var night = manualTheme === 'dark' || (manualTheme === null && (h >= 22 || h < 6));
    body.classList.toggle('theme-dark', night);

    if(manualTheme === 'dark' || (manualTheme === null && (h >= 22 || h < 6))){
      sat = '.52'; bright = '.88'; hue = '-14deg'; tint = '30,40,60'; alpha = '.14';
    }else if(manualTheme === 'light'){
      sat = '.78'; bright = '1.015'; hue = '0deg'; tint = '255,255,255'; alpha = '.10';
    }else if(h < 11){
      sat = '.88'; bright = '1.06'; hue = '8deg'; tint = '255,240,220'; alpha = '.10';
    }else if(h < 17){
      sat = '.78'; bright = '1.015'; hue = '0deg'; tint = '255,255,255'; alpha = '.10';
    }else{
      sat = '.72'; bright = '.96'; hue = '14deg'; tint = '255,225,190'; alpha = '.12';
    }

    root.style.setProperty('--bg-saturate', sat);
    root.style.setProperty('--bg-brightness', bright);
    root.style.setProperty('--bg-hue', hue);
    root.style.setProperty('--tint-rgb', tint);
    root.style.setProperty('--tint-a', alpha);
    syncThemeToggle();
  }

  if(themeToggle){
    themeToggle.addEventListener('click', function(){
      var current = manualTheme || 'auto';
      setThemeMode(current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto');
    });
  }

  applyTimeTheme();
  setInterval(applyTimeTheme, 60000);'''
    js = replace_once(js, old_theme, new_theme, "theme mode implementation")
    js = replace_once(
        js,
        '''      case 'theme':
        if(arg === 'dark'){ manualTheme = 'dark'; applyTimeTheme(); cLog('theme: dark', 'ok'); }
        else if(arg === 'light'){ manualTheme = 'light'; applyTimeTheme(); cLog('theme: light', 'ok'); }
        else if(arg === 'auto'){ manualTheme = null; applyTimeTheme(); cLog('theme: auto (time-of-day)', 'ok'); }
        else cLog('usage: theme dark | light | auto', 'err');
        break;''',
        '''      case 'theme':
        if(arg === 'dark' || arg === 'light' || arg === 'auto'){
          setThemeMode(arg);
          cLog('theme: ' + arg + (arg === 'auto' ? ' (time-of-day)' : ''), 'ok');
        }else cLog('usage: theme dark | light | auto', 'err');
        break;''',
        "terminal theme synchronization",
    )
    js = replace_once(js,
        '''    var message = gbInput.value.trim().slice(0, 160);
    if(!message) return;
    gbSubmit.disabled = true;''',
        '''    var message = gbInput.value.trim().slice(0, 160);
    if(!message){ showToast('WRITE A MESSAGE FIRST'); gbInput.focus(); return; }
    gbSubmit.disabled = true;''',
        "guestbook empty-message validation",
    )

    # worker/worker.js: narrow public relay surface and validate user-controlled query arguments.
    worker = replace_once(worker,
        "const ALLOWED = ['method', 'user', 'limit', 'period', 'from', 'to', 'extended'];",
        "const ALLOWED = ['method', 'user', 'limit', 'period', 'from', 'to', 'extended'];\nconst LASTFM_METHODS = new Set(['user.getrecenttracks', 'user.gettopartists']);",
        "Last.fm method allowlist")
    worker = replace_once(worker,
        '''  const method = url.searchParams.get('method');
  if (!method) return json({ error: 'method is required' }, 400);

  const target = new URL('https://ws.audioscrobbler.com/2.0/');''',
        '''  const method = url.searchParams.get('method');
  if (!method) return json({ error: 'method is required' }, 400);
  if (!LASTFM_METHODS.has(method)) return json({ error: 'method not allowed' }, 400);

  const user = url.searchParams.get('user') || '';
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(user)) return json({ error: 'invalid user' }, 400);

  const limit = url.searchParams.get('limit');
  if (limit !== null && (!/^[0-9]{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50)) {
    return json({ error: 'invalid limit' }, 400);
  }

  const target = new URL('https://ws.audioscrobbler.com/2.0/');''',
        "Last.fm parameter validation")
    worker = replace_once(worker,
        '''    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {''',
        '''    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, { Allow: 'GET, OPTIONS' });

    try {''',
        "worker GET-only policy")
    worker = replace_once(worker,
        "      return json({ error: 'worker crash', message: String(error && error.message) }, 500);",
        "      return json({ error: 'worker crash' }, 500);",
        "worker internal error disclosure")

    changed = {
        Path("index.html"): html,
        Path("css/style.css"): css,
        Path("js/app.js"): js,
        Path("worker/worker.js"): worker,
    }
    # Validate all expected changes before touching files.
    assertions = [
        ('Asuka asset', 'src="assets/asuka.webp"' in html and 'assets/lucy.webp' not in html),
        ('theme control', 'id="theme-toggle"' in html and '.theme-toggle' in css),
        ('persisted theme', "localStorage.setItem('shiokaze_theme', mode)" in js),
        ('shared terminal theme state', 'setThemeMode(arg)' in js),
        ('empty-message guard', 'WRITE A MESSAGE FIRST' in js),
        ('proxy method allowlist', 'LASTFM_METHODS' in worker),
        ('proxy GET-only policy', "request.method !== 'GET'" in worker),
    ]
    failed = [name for name, ok in assertions if not ok]
    if failed:
        fail("Internal validation failed: " + ", ".join(failed) + ". No files have been changed.")

    backup_dir = ROOT / ("backup-before-shiokaze-polish-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    backup_dir.mkdir()
    for path in FILES:
        backup_path = backup_dir / path
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / path, backup_path)

    try:
        for path, content in changed.items():
            out = content.replace("\n", newline)
            (ROOT / path).write_text(out, encoding="utf-8", newline="")
        if shutil.which("node"):
            subprocess.run(["node", "--check", str(ROOT / Path("js/app.js"))], check=True, capture_output=True, text=True)
            # Cloudflare Worker is an ES module; parse it in module mode from stdin.
            worker_source = (ROOT / Path("worker/worker.js")).read_text(encoding="utf-8")
            subprocess.run(["node", "--input-type=module", "--check"], input=worker_source, check=True, capture_output=True, text=True)
            print("Node syntax checks: passed")
        else:
            print("Node.js not found; skipped node --check. Source checks passed.")
    except Exception as exc:
        for path in FILES:
            shutil.copy2(backup_dir / path, ROOT / path)
        fail(f"Validation failed; original files restored from {backup_dir.name}. Details: {exc}")

    print("Applied polish to:")
    for path in FILES:
        print(f"  - {path}")
    print(f"Backup: {backup_dir}")
    print("Note: worker/worker.js still needs to be deployed separately to Cloudflare Workers.")
    print("Note: guestbook anti-spam must also be enforced in Supabase; browser-only throttling is not a security boundary.")

if __name__ == "__main__":
    main()
