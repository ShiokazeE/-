(() => {
  'use strict';

  const CONFIG = {
    discordId: '912747427465928754',
    discordProxy: 'https://lanyard-proxy.lopgg96.workers.dev/v1/users/',
    listenBrainzUser: 'Sh10kaze',
    supabaseUrl: 'https://sdqfeycfahemliivrujg.supabase.co',
    supabaseKey: 'sb_publishable_WVjFpsuPNUu8KJ-1UNL8qA_mDYwlUZG',
    email: 'lopgg96@gmail.com'
  };

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    activeModule: null,
    discord: null,
    music: null,
    messages: [],
    ownerSession: null,
    soundEnabled: true,
    audioPlaying: false,
    toastTimer: 0,
    guestbookLoaded: false,
    statsLoaded: false
  };

  // ---------------------------------------------------------------------------
  // Procedural black hole: lightweight WebGL shader, no external 3D runtime.
  // ---------------------------------------------------------------------------
  function initUniverse() {
    const canvas = $('universe');
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance'
    });
    if (!gl) {
      body.classList.add('no-webgl');
      return;
    }

    const vertexSource = [
      'attribute vec2 a_position;',
      'void main() { gl_Position = vec4(a_position, 0.0, 1.0); }'
    ].join('\n');

    const fragmentSource = [
      'precision highp float;',
      'uniform vec2 u_resolution;',
      'uniform vec2 u_mouse;',
      'uniform float u_time;',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(123.34, 456.21));',
      '  p += dot(p, p + 45.32);',
      '  return fract(p.x * p.y);',
      '}',
      'float starLayer(vec2 uv, float density, float threshold, float scale) {',
      '  vec2 grid = uv * density;',
      '  vec2 cell = floor(grid);',
      '  vec2 f = fract(grid) - 0.5;',
      '  float total = 0.0;',
      '  for (int y = -1; y <= 1; y++) {',
      '    for (int x = -1; x <= 1; x++) {',
      '      vec2 offset = vec2(float(x), float(y));',
      '      vec2 id = cell + offset;',
      '      float seed = hash21(id);',
      '      vec2 point = vec2(hash21(id + 2.7), hash21(id + 8.3)) - 0.5;',
      '      float d = length(offset + point - f);',
      '      float radius = mix(0.012, 0.043, hash21(id + 11.1)) * scale;',
      '      float star = 1.0 - smoothstep(radius * 0.25, radius, d);',
      '      star *= step(threshold, seed);',
      '      total += star * (0.3 + 0.7 * hash21(id + 4.8));',
      '    }',
      '  }',
      '  return total;',
      '}',
      'float softNoise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i);',
      '  float b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0));',
      '  float d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
      '}',
      'void main() {',
      '  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);',
      '  vec2 uv = (gl_FragCoord.xy / u_resolution.xy - 0.5) * aspect;',
      '  float t = u_time * 0.16;',
      '  vec2 p = uv - vec2(0.055, 0.015) + u_mouse * 0.022;',
      '  float r = length(p);',
      '  float a = atan(p.y, p.x);',
      '  vec2 radial = p / max(r, 0.001);',
      '  float bend = 0.022 / (r * r + 0.0035);',
      '  vec2 warped = p + radial * bend;',
      '  vec2 starCoords = warped + vec2(-0.09, 0.0);',
      '  float stars = starLayer(starCoords, 92.0, 0.91, 1.0);',
      '  stars += starLayer(starCoords + vec2(0.12, 0.2), 168.0, 0.973, 0.62) * 0.7;',
      '  vec3 col = mix(vec3(0.012, 0.015, 0.021), vec3(0.0025, 0.0035, 0.006), smoothstep(0.05, 0.78, length(uv)));',
      '  col += stars * vec3(0.56, 0.64, 0.72) * 0.78;',
      '  float diskRadius = length(vec2(p.x, p.y * 3.7));',
      '  float angular = atan(p.y * 3.7, p.x);',
      '  float turbulence = softNoise(vec2(angular * 3.0 + t * 1.8, diskRadius * 34.0 - t * 2.2));',
      '  float rotation = 0.67 + 0.22 * sin(angular * 2.7 - t * 3.0 + diskRadius * 29.0);',
      '  float beaming = 0.57 + 0.43 * smoothstep(-0.92, 0.9, cos(angular - 0.38));',
      '  float innerBand = exp(-pow((diskRadius - 0.285) / 0.013, 2.0));',
      '  float mainBand = exp(-pow((diskRadius - 0.326) / 0.024, 2.0));',
      '  float outerBand = exp(-pow((diskRadius - 0.372) / 0.032, 2.0));',
      '  float disk = (innerBand * 0.92 + mainBand * 0.7 + outerBand * 0.22);',
      '  disk *= rotation * beaming * (0.78 + turbulence * 0.42);',
      '  float hotEdge = exp(-pow((diskRadius - 0.284) / 0.0065, 2.0));',
      '  vec3 warm = mix(vec3(0.49, 0.16, 0.065), vec3(0.91, 0.47, 0.22), hotEdge);',
      '  warm = mix(warm, vec3(1.0, 0.79, 0.53), hotEdge * 0.55);',
      '  col += warm * disk * 1.08;',
      '  float photon = exp(-pow((r - 0.137) / 0.0045, 2.0));',
      '  float lensGlow = exp(-pow((r - 0.16) / 0.028, 2.0));',
      '  col += vec3(1.0, 0.72, 0.46) * photon * 0.72;',
      '  col += vec3(0.34, 0.15, 0.075) * lensGlow * 0.28;',
      '  float horizon = smoothstep(0.118, 0.132, r);',
      '  col *= horizon;',
      '  float edgeShade = smoothstep(0.12, 0.19, r);',
      '  col *= 0.82 + edgeShade * 0.18;',
      '  col += vec3(0.28, 0.085, 0.035) * exp(-r * 3.4) * 0.12;',
      '  float vignette = 1.0 - smoothstep(0.48, 1.1, length(uv * vec2(0.82, 1.0)));',
      '  col *= vignette;',
      '  col = pow(max(col, 0.0), vec3(0.91));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error('Shader compilation failed');
      }
      return shader;
    }

    let program;
    try {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    } catch {
      body.classList.add('no-webgl');
      return;
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const mouse = gl.getUniformLocation(program, 'u_mouse');

    let width = 0;
    let height = 0;
    let raf = 0;
    let startedAt = performance.now();
    let pointer = [0, 0];
    let targetPointer = [0, 0];
    let destroyed = false;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.65);
      const nextWidth = Math.max(1, Math.floor(window.innerWidth * ratio));
      const nextHeight = Math.max(1, Math.floor(window.innerHeight * ratio));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
    }

    function frame(now) {
      raf = 0;
      if (destroyed || document.hidden) return;
      resize();
      pointer[0] += (targetPointer[0] - pointer[0]) * 0.045;
      pointer[1] += (targetPointer[1] - pointer[1]) * 0.045;
      gl.uniform1f(time, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.uniform2f(mouse, pointer[0], pointer[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      targetPointer[0] = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      targetPointer[1] = (0.5 - event.clientY / Math.max(1, window.innerHeight)) * 2;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !destroyed) {
        raf = requestAnimationFrame(frame);
      }
    });

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      body.classList.add('no-webgl');
    });

    resize();
    raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Shared UI helpers
  // ---------------------------------------------------------------------------
  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value == null ? '' : String(value);
  }

  function safeHttps(value) {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function fetchJson(url, timeoutMs = 9000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .finally(() => window.clearTimeout(timeout));
  }

  function getTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'LOCAL'; }
    catch { return 'LOCAL'; }
  }

  function updateClock() {
    const now = new Date();
    const clock = $('clock');
    if (clock) clock.textContent = now.toLocaleTimeString([], { hour12: false });
    const tz = $('timezone');
    if (tz) tz.textContent = getTimezone().toUpperCase();
    const identityClock = $('identity-clock');
    if (identityClock) identityClock.textContent = now.toLocaleTimeString([], { hour12: false });
    const identityTimezone = $('identity-timezone');
    if (identityTimezone) identityTimezone.textContent = getTimezone();
  }

  function enterObservatory() {
    const entry = $('entry-layer');
    if (!entry || entry.classList.contains('is-leaving')) return;
    entry.classList.add('is-leaving');
    body.classList.remove('is-locked');
    body.classList.add('is-entered');
    try { sessionStorage.setItem('shiokaze_entered', '1'); } catch {}
    if (state.soundEnabled) startAudio();
    window.setTimeout(() => {
      if (entry.isConnected) entry.remove();
    }, 1050);
  }

  // ---------------------------------------------------------------------------
  // Audio: explicit user gesture, existing ambient track, fixed 15% volume.
  // ---------------------------------------------------------------------------
  const audio = $('ambience');
  const soundButton = $('sound-toggle');

  function syncSoundButton() {
    if (!soundButton) return;
    soundButton.setAttribute('aria-pressed', String(state.audioPlaying));
    setText('sound-label', state.audioPlaying ? 'SOUND ON' : 'SOUND OFF');
  }

  async function startAudio() {
    if (!audio) return;
    audio.volume = 0.15;
    try {
      await audio.play();
      state.audioPlaying = true;
      state.soundEnabled = true;
      try { localStorage.setItem('shiokaze_ambience', '1'); } catch {}
    } catch {
      state.audioPlaying = false;
      state.soundEnabled = false;
      try { localStorage.setItem('shiokaze_ambience', '0'); } catch {}
      showToast('AUDIO UNAVAILABLE');
    }
    syncSoundButton();
  }

  function stopAudio() {
    if (!audio) return;
    audio.pause();
    state.audioPlaying = false;
    state.soundEnabled = false;
    try { localStorage.setItem('shiokaze_ambience', '0'); } catch {}
    syncSoundButton();
  }

  function toggleAudio() {
    if (state.audioPlaying) stopAudio();
    else {
      state.soundEnabled = true;
      startAudio();
    }
  }

  // ---------------------------------------------------------------------------
  // Module navigation
  // ---------------------------------------------------------------------------
  const moduleMeta = {
    identity: { number: '01', title: 'IDENTITY', template: 'identity-template' },
    signal: { number: '02', title: 'SIGNAL', template: 'signal-template' },
    transmissions: { number: '03', title: 'TRANSMISSIONS', template: 'transmissions-template' },
    network: { number: '04', title: 'NETWORK', template: 'network-template' }
  };

  let lastOpenedModule = 'identity';
  let panelCloseTimer = 0;

  function openModule(name) {
    const meta = moduleMeta[name];
    if (!meta) return;
    const panel = $('module-panel');
    const content = $('panel-content');
    if (!panel || !content) return;

    window.clearTimeout(panelCloseTimer);
    state.activeModule = name;
    lastOpenedModule = name;
    setText('panel-kicker', meta.number + ' / ' + meta.title);
    setText('panel-title', meta.title);
    const template = $(meta.template);
    content.replaceChildren(template.content.cloneNode(true));
    panel.hidden = false;
    body.classList.add('module-open');

    if (name === 'identity') updateClock();
    if (name === 'signal') {
      renderDiscord();
      renderMusic();
      fetchDiscord();
      fetchMusic();
    }
    if (name === 'transmissions') {
      bindGuestbookForm();
      renderMessages();
      loadMessages();
    }
    if (name === 'network') bindNetwork();
    window.setTimeout(() => $('panel-close')?.focus(), 70);
  }

  function closeModule() {
    const panel = $('module-panel');
    if (!panel || panel.hidden) return;
    body.classList.remove('module-open');
    state.activeModule = null;
    window.clearTimeout(panelCloseTimer);
    panelCloseTimer = window.setTimeout(() => { panel.hidden = true; }, 370);
    document.querySelector('[data-module="' + lastOpenedModule + '"]')?.focus();
  }

  document.querySelectorAll('[data-module]').forEach((button) => {
    button.addEventListener('click', () => openModule(button.dataset.module));
  });
  $('panel-close')?.addEventListener('click', closeModule);
  $('panel-backdrop')?.addEventListener('click', closeModule);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.activeModule) closeModule();
      if (!$('owner-modal')?.hidden) $('owner-modal').hidden = true;
    }
  });

  // ---------------------------------------------------------------------------
  // Supabase: visitor stats, rating, guestbook and owner tools.
  // Visitor-controlled strings are inserted as text nodes, never HTML.
  // ---------------------------------------------------------------------------
  async function api(path, options = {}, token = '') {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    const headers = {
      apikey: CONFIG.supabaseKey,
      Authorization: 'Bearer ' + (token || CONFIG.supabaseKey),
      'Content-Type': 'application/json'
    };
    if (options.headers) Object.assign(headers, options.headers);

    try {
      const response = await fetch(CONFIG.supabaseUrl + path, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: controller.signal
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok) {
        const reason = data && (data.message || data.error_description || data.hint);
        throw new Error(reason || 'Request failed (' + response.status + ')');
      }
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function visitorKey() {
    try {
      let key = localStorage.getItem('shiokaze_visitor_id');
      if (key) return key;
      key = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('shiokaze_visitor_id', key);
      return key;
    } catch {
      return 'v-' + Date.now().toString(36);
    }
  }

  async function loadSiteStats() {
    try {
      const visit = await api('/rest/v1/rpc/register_site_visit', {
        method: 'POST',
        body: JSON.stringify({ p_visitor_id: visitorKey() })
      });
      if (visit && typeof visit === 'object') {
        setText('visit-count', visit.visits || visit.total_visits || '—');
      }
      const stats = await api('/rest/v1/rpc/get_site_stats');
      if (stats) {
        const record = Array.isArray(stats) ? stats[0] : stats;
        if (record) {
          setText('visit-count', record.total_visits || record.visits || $('visit-count')?.textContent || '—');
          setText('rating-value', record.average_rating ? Number(record.average_rating).toFixed(1) : '—');
        }
      }
      state.statsLoaded = true;
    } catch {
      setText('visit-count', '—');
      setText('rating-value', '—');
    }
  }

  function paintRating(value) {
    const root = $('rating-stars');
    if (!root) return;
    root.querySelectorAll('[data-rating]').forEach((button) => {
      const number = Number(button.dataset.rating);
      button.classList.toggle('is-active', number <= value);
      button.setAttribute('aria-checked', String(number === value));
    });
  }

  let savedRating = 0;
  try { savedRating = Number(localStorage.getItem('shiokaze_rating') || 0); } catch {}
  paintRating(savedRating);

  $('rating-stars')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-rating]');
    if (!button) return;
    const rating = Math.max(1, Math.min(5, Number(button.dataset.rating) || 0));
    paintRating(rating);
    try { localStorage.setItem('shiokaze_rating', String(rating)); } catch {}
    try {
      await api('/rest/v1/rpc/submit_site_rating', {
        method: 'POST',
        body: JSON.stringify({ p_visitor_id: visitorKey(), p_rating: rating })
      });
      await loadSiteStats();
      showToast('RATING RECEIVED');
    } catch {
      showToast('RATING COULD NOT BE SAVED');
    }
  });

  $('rating-stars')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = Array.from($('rating-stars').querySelectorAll('[data-rating]'));
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(4, current + (event.key === 'ArrowRight' ? 1 : -1)));
    buttons[next].focus();
    buttons[next].click();
  });

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function createMessageNode(message) {
    const article = document.createElement('article');
    article.className = 'transmission-item';
    const meta = document.createElement('div');
    meta.className = 'transmission-meta';
    const name = document.createElement('strong');
    name.textContent = String(message.name || 'anonymous').slice(0, 32);
    const date = document.createElement('time');
    date.textContent = formatDate(message.created_at);
    meta.append(name, date);

    const text = document.createElement('p');
    text.className = 'transmission-text';
    text.textContent = String(message.message || '').slice(0, 160);
    article.append(meta, text);

    if (message.author_reply) {
      const reply = document.createElement('div');
      reply.className = 'transmission-reply';
      const label = document.createElement('span');
      label.textContent = 'OPERATOR REPLY';
      const replyText = document.createElement('p');
      replyText.textContent = String(message.author_reply).slice(0, 500);
      reply.append(label, replyText);
      article.append(reply);
    }

    if (state.ownerSession) {
      const controls = document.createElement('div');
      controls.className = 'owner-actions';
      const like = document.createElement('button');
      like.type = 'button';
      like.dataset.like = String(message.id);
      like.textContent = message.author_liked ? '♥ LIKED' : '♥ LIKE';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.dataset.editReply = String(message.id);
      edit.textContent = message.author_reply ? 'EDIT REPLY' : 'REPLY';
      controls.append(like, edit);
      article.append(controls);
    }
    return article;
  }

  function renderMessages() {
    const list = $('guestbook-list');
    if (!list) return;
    list.replaceChildren();
    if (!state.messages.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-line';
      empty.textContent = state.guestbookLoaded ? 'NO TRANSMISSIONS YET — SEND THE FIRST.' : 'LOADING TRANSMISSIONS…';
      list.append(empty);
      return;
    }
    state.messages.forEach((message) => list.append(createMessageNode(message)));
  }

  async function loadMessages() {
    try {
      const fields = 'id,name,contact,message,created_at,author_liked,author_reply,author_reply_at';
      let data;
      try {
        data = await api('/rest/v1/guestbook_comments?select=' + fields + '&order=created_at.desc&limit=50');
      } catch {
        // Keep compatibility with the earlier table schema where reply columns may not exist.
        data = await api('/rest/v1/guestbook_comments?select=id,name,contact,message,created_at,author_liked&order=created_at.desc&limit=50');
        if (Array.isArray(data)) {
          data = data.map((item) => ({ ...item, author_reply: null, author_reply_at: null }));
        }
      }
      state.messages = Array.isArray(data) ? data : [];
      state.guestbookLoaded = true;
      renderMessages();
    } catch {
      state.guestbookLoaded = true;
      const list = $('guestbook-list');
      if (list) {
        list.replaceChildren();
        const error = document.createElement('div');
        error.className = 'empty-line';
        error.textContent = 'TRANSMISSION CHANNEL OFFLINE';
        list.append(error);
      }
    }
  }

  function bindGuestbookForm() {
    const form = $('guestbook-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = $('guest-name');
      const messageInput = $('guest-message');
      const honeypot = $('guest-website');
      const submit = $('guest-submit');
      if (honeypot?.value) return;

      let lastSend = 0;
      try { lastSend = Number(localStorage.getItem('gb_last_send') || 0); } catch {}
      const remaining = 30000 - (Date.now() - lastSend);
      if (remaining > 0) {
        showToast('PLEASE WAIT ' + Math.ceil(remaining / 1000) + 'S');
        return;
      }

      const name = (nameInput?.value.trim() || 'anonymous').slice(0, 32);
      const message = (messageInput?.value || '').trim().slice(0, 160);
      if (!message) {
        showToast('WRITE A MESSAGE FIRST');
        messageInput?.focus();
        return;
      }

      if (submit) submit.disabled = true;
      try {
        await api('/rest/v1/guestbook_comments', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ name, contact: null, message })
        });
        try { localStorage.setItem('gb_last_send', String(Date.now())); } catch {}
        form.reset();
        showToast('TRANSMISSION SENT');
        await loadMessages();
      } catch {
        showToast('TRANSMISSION FAILED');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  $('panel-content')?.addEventListener('click', async (event) => {
    const like = event.target.closest('[data-like]');
    const editReply = event.target.closest('[data-edit-reply]');
    if (!state.ownerSession) return;

    if (like) {
      like.disabled = true;
      try {
        await api('/rest/v1/rpc/toggle_author_like', {
          method: 'POST',
          body: JSON.stringify({ p_comment_id: like.dataset.like })
        }, state.ownerSession.access_token);
        await loadMessages();
      } catch {
        showToast('LIKE FAILED');
        like.disabled = false;
      }
      return;
    }

    if (editReply) {
      const id = editReply.dataset.editReply;
      const existing = state.messages.find((item) => String(item.id) === id);
      const reply = window.prompt('Operator reply (max 500 characters):', existing?.author_reply || '');
      if (reply === null) return;
      const trimmed = reply.trim().slice(0, 500);
      if (!trimmed) {
        showToast('REPLY WAS NOT CHANGED');
        return;
      }
      editReply.disabled = true;
      try {
        await api('/rest/v1/rpc/set_author_reply', {
          method: 'POST',
          body: JSON.stringify({ p_comment_id: id, p_reply: trimmed })
        }, state.ownerSession.access_token);
        await loadMessages();
        showToast('REPLY SENT');
      } catch {
        showToast('REPLY NOT ENABLED');
        editReply.disabled = false;
      }
    }
  });

  // Owner authentication mirrors the previous page's Supabase session flow.
  const ownerModal = $('owner-modal');
  const ownerForm = $('owner-form');
  const ownerEmail = $('owner-email');
  const ownerPassword = $('owner-password');
  const ownerLogout = $('owner-logout');
  const ownerSession = $('owner-session');
  const ownerSubmit = ownerForm?.querySelector('[type="submit"]');

  function syncOwnerUI() {
    const active = Boolean(state.ownerSession);
    if (ownerEmail) ownerEmail.hidden = active;
    if (ownerPassword) ownerPassword.hidden = active;
    if (ownerSubmit) ownerSubmit.hidden = active;
    if (ownerLogout) ownerLogout.hidden = !active;
    if (ownerSession) ownerSession.hidden = !active;
    if (ownerSession) ownerSession.textContent = active ? 'OPERATOR SESSION ACTIVE' : '';
    if (state.activeModule === 'transmissions') renderMessages();
  }

  $('panel-content')?.addEventListener('click', (event) => {
    if (event.target.closest('#owner-open')) {
      if (ownerModal) ownerModal.hidden = false;
      setText('owner-error', '');
    }
  });

  ownerModal?.addEventListener('click', (event) => {
    if (event.target.matches('[data-owner-close]') || event.target.classList.contains('owner-backdrop')) {
      ownerModal.hidden = true;
    }
  });

  ownerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setText('owner-error', '');
    try {
      const session = await api('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: ownerEmail.value.trim(), password: ownerPassword.value || '' })
      });
      if (!session?.access_token) throw new Error('LOGIN FAILED');
      state.ownerSession = session;
      try { localStorage.setItem('shiokaze_author_session', JSON.stringify(session)); } catch {}
      ownerModal.hidden = true;
      syncOwnerUI();
      await loadMessages();
      showToast('OPERATOR AUTHENTICATED');
    } catch (error) {
      setText('owner-error', error.message || 'LOGIN FAILED');
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem('shiokaze_author_session') || 'null');
    if (saved?.access_token && saved?.expires_at * 1000 > Date.now()) state.ownerSession = saved;
    else if (saved) localStorage.removeItem('shiokaze_author_session');
  } catch {}
  syncOwnerUI();

  ownerLogout?.addEventListener('click', () => {
    state.ownerSession = null;
    try { localStorage.removeItem('shiokaze_author_session'); } catch {}
    syncOwnerUI();
    loadMessages();
    if (ownerModal) ownerModal.hidden = true;
    showToast('OPERATOR SESSION CLOSED');
  });

  window.setInterval(() => {
    if (state.ownerSession?.expires_at && state.ownerSession.expires_at * 1000 <= Date.now()) {
      state.ownerSession = null;
      try { localStorage.removeItem('shiokaze_author_session'); } catch {}
      syncOwnerUI();
      showToast('OPERATOR SESSION EXPIRED');
    }
  }, 60000);

  function bindNetwork() {
    $('copy-address')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(CONFIG.email);
        showToast('EMAIL ADDRESS COPIED');
      } catch {
        showToast('COPY IS NOT AVAILABLE');
      }
    }, { once: true });
  }

  // ---------------------------------------------------------------------------
  // Discord presence (Lanyard proxy) and ListenBrainz listening feed.
  // ---------------------------------------------------------------------------
  function renderDiscord() {
    const data = state.discord;
    if (!data) return;
    const user = data.discord_user || {};
    const avatar = $('discord-avatar');
    if (avatar) {
      const source = user.avatar
        ? 'https://cdn.discordapp.com/avatars/' + CONFIG.discordId + '/' + user.avatar + '.' + (user.avatar.startsWith('a_') ? 'gif' : 'webp') + '?size=96'
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
      avatar.src = safeHttps(source) || 'https://cdn.discordapp.com/embed/avatars/0.png';
    }
    setText('discord-name', user.global_name || user.username || 'Shiokaze');
    const status = data.discord_status || 'offline';
    setText('discord-status', status.toUpperCase());
    const dot = $('discord-status-dot');
    if (dot) dot.className = status === 'online' || status === 'idle' || status === 'dnd' ? status : '';

    const activities = Array.isArray(data.activities) ? data.activities : [];
    const activity = activities.find((item) => item.type === 0)
      || activities.find((item) => item.type === 2)
      || activities.find((item) => item.type === 1)
      || activities.find((item) => item.type === 3)
      || activities.find((item) => item.type === 4);
    let line = 'No public activity';
    if (activity) {
      line = activity.details || activity.state || activity.name || 'Active on Discord';
      if (activity.state && activity.details && activity.state !== activity.details) {
        line += ' · ' + activity.state;
      }
    } else if (status === 'dnd') {
      line = 'Do not disturb';
    } else if (status === 'offline') {
      line = 'Offline right now';
    }
    setText('discord-activity', line);
  }

  async function fetchDiscord() {
    try {
      const response = await fetchJson(CONFIG.discordProxy + CONFIG.discordId, 8000);
      if (!response?.data) throw new Error('Presence unavailable');
      state.discord = response.data;
    } catch {
      state.discord = {
        discord_status: 'offline',
        discord_user: { global_name: 'Shiokaze' },
        activities: []
      };
    }
    if (state.activeModule === 'signal') renderDiscord();
  }

  function normaliseListen(listen, nowPlaying = false) {
    const metadata = listen?.track_metadata || {};
    const extra = metadata.additional_info || {};
    return {
      title: metadata.track_name || 'Unknown track',
      artist: metadata.artist_name || 'Unknown artist',
      album: metadata.release_name || '',
      listenedAt: listen.listened_at ? Number(listen.listened_at) : 0,
      nowPlaying,
      url: safeHttps(extra.origin_url) || (extra.recording_mbid
        ? 'https://musicbrainz.org/recording/' + encodeURIComponent(extra.recording_mbid)
        : '')
    };
  }

  function renderMusic() {
    const music = state.music;
    if (!music) return;
    setText('music-state', music.current?.nowPlaying ? 'NOW PLAYING' : 'LAST LISTENED');
    setText('track-title', music.current?.title || 'Nothing scrobbled yet');
    setText('track-artist', music.current?.artist || '—');
    setText('track-album', music.current?.album || '');
    const link = $('track-link');
    if (link) {
      const url = safeHttps(music.current?.url || '');
      link.hidden = !url;
      if (url) link.href = url;
    }

    const art = $('track-art');
    if (art) {
      art.replaceChildren();
      if (music.artwork) {
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.src = music.artwork;
        art.append(image);
      } else {
        const fallback = document.createElement('span');
        fallback.textContent = '♪';
        art.append(fallback);
      }
    }

    const history = $('listening-list');
    if (history) {
      history.replaceChildren();
      (music.history || []).slice(0, 6).forEach((track, index) => {
        const row = document.createElement('div');
        row.className = 'listening-row';
        const number = document.createElement('span');
        number.className = 'row-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('strong');
        title.textContent = track.title;
        const artist = document.createElement('small');
        artist.textContent = track.artist;
        row.append(number, title, artist);
        history.append(row);
      });
      if (!(music.history || []).length) {
        const empty = document.createElement('div');
        empty.className = 'empty-line';
        empty.textContent = 'NO RECENT LISTENS';
        history.append(empty);
      }
    }

    const artists = $('artist-list');
    if (artists) {
      artists.replaceChildren();
      (music.artists || []).slice(0, 5).forEach((artist, index) => {
        const row = document.createElement('div');
        row.className = 'artist-row';
        const number = document.createElement('span');
        number.className = 'row-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('strong');
        title.textContent = artist.name;
        const count = document.createElement('small');
        count.textContent = artist.count + ' PLAYS';
        row.append(number, title, count);
        artists.append(row);
      });
      if (!(music.artists || []).length) {
        const empty = document.createElement('div');
        empty.className = 'empty-line';
        empty.textContent = 'NO ARTIST DATA';
        artists.append(empty);
      }
    }
  }

  async function lookupArtwork(track) {
    if (!track?.title || !track?.artist) return '';
    try {
      const term = encodeURIComponent(track.artist + ' ' + track.title);
      const data = await fetchJson('https://itunes.apple.com/search?term=' + term + '&entity=song&limit=1', 7500);
      const url = data?.results?.[0]?.artworkUrl100;
      return safeHttps(url ? url.replace('100x100bb', '600x600bb') : '');
    } catch {
      return '';
    }
  }

  async function fetchMusic() {
    const base = 'https://api.listenbrainz.org/1/user/' + encodeURIComponent(CONFIG.listenBrainzUser);
    try {
      const [recentResponse, nowResponse] = await Promise.all([
        fetchJson(base + '/listens?count=20', 12000),
        fetchJson(base + '/playing-now', 8000).catch(() => null)
      ]);
      const recentListens = recentResponse?.payload?.listens || [];
      const playingListens = nowResponse?.payload?.listens || [];
      const recent = recentListens.map((listen) => normaliseListen(listen));
      const now = playingListens[0] ? normaliseListen(playingListens[0], true) : null;
      const current = now || recent[0] || null;
      const history = recent.filter((track) => !current || track.title !== current.title || track.artist !== current.artist).slice(0, 6);

      const counts = new Map();
      recent.slice(0, 20).forEach((track) => {
        if (track.artist) counts.set(track.artist, (counts.get(track.artist) || 0) + 1);
      });
      const artists = Array.from(counts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      state.music = { current, history, artists, artwork: '' };
      if (current) state.music.artwork = await lookupArtwork(current);
    } catch {
      state.music = {
        current: { title: 'Listening feed unavailable', artist: 'ListenBrainz', album: '', url: '', nowPlaying: false },
        history: [],
        artists: [],
        artwork: ''
      };
    }
    if (state.activeModule === 'signal') renderMusic();
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  initUniverse();
  updateClock();
  window.setInterval(updateClock, 1000);

  try {
    state.soundEnabled = localStorage.getItem('shiokaze_ambience') !== '0';
  } catch {
    state.soundEnabled = true;
  }

  $('enter-button')?.addEventListener('click', enterObservatory);
  $('entry-layer')?.addEventListener('click', (event) => {
    if (event.target.id === 'entry-layer') enterObservatory();
  });
  document.addEventListener('keydown', (event) => {
    if (!body.classList.contains('is-locked')) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Escape'].includes(event.key)) return;
    enterObservatory();
  });

  soundButton?.addEventListener('click', toggleAudio);

  let skipEntry = new URLSearchParams(location.search).has('enter');
  try { skipEntry = skipEntry || sessionStorage.getItem('shiokaze_entered') === '1'; } catch {}
  if (skipEntry) {
    const entry = $('entry-layer');
    if (entry) entry.remove();
    body.classList.remove('is-locked');
    body.classList.add('is-entered');
  }
  syncSoundButton();

  loadSiteStats();
  fetchDiscord();
  fetchMusic();

  window.setInterval(() => {
    if (!document.hidden) fetchDiscord();
  }, 45000);

  window.setInterval(() => {
    if (!document.hidden && state.activeModule === 'transmissions') loadMessages();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.activeModule === 'signal') {
      fetchDiscord();
      fetchMusic();
    }
    if (state.activeModule === 'transmissions') loadMessages();
    if (!state.statsLoaded) loadSiteStats();
  });
})();