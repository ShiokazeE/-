(function(){
  'use strict';

  /* =========================================================
     CONFIG — всё, что нужно подставить под себя
     ========================================================= */
  var CONFIG = {
    music: 'listenbrainz',                      // основной источник: 'listenbrainz' | 'lastfm'
    listenbrainz: {
      user: 'Sh10kaze',                          // ← ник на listenbrainz.org
    },
    lastfm: {
      user: 'Japansxow',                         // ← ник на last.fm
      apiKey: '',                                // ← ключ last.fm: работает без воркера (JSONP)
      proxy: 'https://lanyard-proxy.lopgg96.workers.dev/lastfm',
      history: 6,                                // строк в history
      artists: 5,                                // строк в top artists
      period: '7day'
    },
    github: 'ShiokazeE',
    discord: {
      id: '912747427465928754',
      proxy: 'https://lanyard-proxy.lopgg96.workers.dev/v1/users/'
    },
    supabase: {
      url: 'https://sdqfeycfahemliivrujg.supabase.co',
      key: 'sb_publishable_WVjFpsuPNUu8KJ-1UNL8qA_mDYwlUZG'
    },
    ambienceVolume: 0.15
  };

  var params = new URLSearchParams(location.search);
  if(params.get('lastfm')) CONFIG.lastfm.user = params.get('lastfm');   // ?lastfm=rj для проверки
  if(params.get('lb')){ CONFIG.music = 'listenbrainz'; CONFIG.listenbrainz.user = params.get('lb'); }
  var MOCK = params.has('mock');                                        // ?mock=1 — демо-данные без бэкенда

  /* =========================================================
     HELPERS
     ========================================================= */
  var root = document.documentElement;
  var body = document.body;
  var $ = function(id){ return document.getElementById(id); };
  var toast = $('toast');
  var toastTimer;

  function showToast(text){
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 1800);
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function fetchJson(url, ms){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, ms || 8000);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal }).then(function(r){
      clearTimeout(timer);
      if(!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function(err){
      clearTimeout(timer);
      throw err;
    });
  }

  function timeAgo(uts){
    var n = Number(uts);
    if(!isFinite(n) || !n) return '';
    var s = Math.max(0, Math.floor(Date.now() / 1000 - n));
    if(s < 45) return 'just now';
    if(s < 3600) return Math.floor(s / 60) + ' min ago';
    if(s < 86400) return Math.floor(s / 3600) + ' h ago';
    if(s < 2592000) return Math.floor(s / 86400) + ' d ago';
    return Math.floor(s / 2592000) + ' mo ago';
  }

  var LASTFM_STAR = '2a96cbd8b46e442fc41c2b86b821562f'; // заглушка last.fm

  // last.fm отдаёт {'#text': '...'}, listenbrainz — обычную строку; пустое значение
  // раньше приводило к "[object Object]" в карточке
  function textOf(value){
    if(!value) return '';
    if(typeof value === 'string') return value;
    return value['#text'] || '';
  }

  // «Röyksopp feat. Susanne Sundfør» → «Röyksopp» (только для топ-артистов)
  function primaryArtist(name){
    var s = String(name || '').trim();
    var cut = s.split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0];
    return (cut || s).trim();
  }

  function artworkOf(images){
    if(!Array.isArray(images)) return '';
    for(var i = images.length - 1; i >= 0; i--){
      var u = images[i] && images[i]['#text'];
      if(u && u.indexOf(LASTFM_STAR) === -1 && u.indexOf('no_image') === -1) return u;
    }
    return '';
  }

  function monogram(text){
    var t = String(text || '').trim();
    var initials = t.split(/\s+/).slice(0, 2).map(function(w){ return w.charAt(0); }).join('').toUpperCase();
    var h = 0;
    for(var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
    return {
      text: initials || '♪',
      bg: 'linear-gradient(145deg,hsl(' + h + ',9%,90%),hsl(' + h + ',11%,77%))'
    };
  }

  function paintTile(el, imageUrl, label){
    el.innerHTML = '';
    if(imageUrl){
      var img = document.createElement('img');
      img.src = imageUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      el.appendChild(img);
      return;
    }
    var m = monogram(label);
    el.textContent = m.text;
    el.style.background = m.bg;
  }

  /* =========================================================
     ENTRY
     ========================================================= */
  var entryScreen = $('entry-screen');
  var entryBtn = $('entry-btn');
  var entryProgress = $('entry-progress-bar');
  var entered = false;

  function finishEntry(){
    entryProgress.style.animation = 'none';
    entryProgress.style.transform = 'scaleX(1)';
    setTimeout(function(){ entryScreen.classList.add('is-leaving'); }, 120);
  }

  function markEntered(){
    body.classList.remove('entry-locked');
    body.classList.add('site-entered');
  }

  function enterInterface(){
    if(entered) return;
    entered = true;
    try{ sessionStorage.setItem('shiokaze_entered', '1'); }catch(e){}
    if(ambienceOn) startAmbience();
    markEntered();
    startChoreo();
    finishEntry();
    setTimeout(function(){ if(entryScreen && entryScreen.remove) entryScreen.remove(); }, 1200);
  }

  // повторный заход в той же вкладке не показывает гейт; ?enter=1 — принудительно пропустить
  var skipEntry = params.has('enter');
  if(!skipEntry){
    try{ skipEntry = sessionStorage.getItem('shiokaze_entered') === '1'; }catch(e){}
  }

  if(skipEntry){
    entered = true;
    markEntered();
    startChoreo();
    if(entryScreen && entryScreen.remove) entryScreen.remove();
  }else{
    window.addEventListener('keydown', enterInterface, { once: true });
    entryBtn.addEventListener('click', enterInterface, { once: true });
  }

  /* =========================================================
     AMBIENCE (murasame.mp3) + audio-reactive variables
     ========================================================= */
  var audio = $('audio');
  var ambienceBtn = $('ambience-toggle');
  var ambienceOn = localStorage.getItem('shiokaze_ambience') !== '0';
  audio.volume = CONFIG.ambienceVolume;

  var audioCtx = null, analyser = null, freqData = null, audioRAF = null, audioInitFailed = false;

  function initAudioEngine(){
    if(audioCtx || audioInitFailed) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var source = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }catch(e){
      audioInitFailed = true;
    }
  }

  function tickAudio(){
    audioRAF = null;
    if(!analyser || document.hidden) return;
    analyser.getByteFrequencyData(freqData);
    var bass = 0, mid = 0, treble = 0, i;
    for(i = 1; i <= 4; i++) bass += freqData[i];
    for(i = 5; i <= 15; i++) mid += freqData[i];
    for(i = 16; i <= 31; i++) treble += freqData[i];
    bass = bass / (4 * 255); mid = mid / (11 * 255); treble = treble / (16 * 255);
    root.style.setProperty('--audio-bass', bass.toFixed(3));
    root.style.setProperty('--audio-mid', mid.toFixed(3));
    root.style.setProperty('--audio-treble', treble.toFixed(3));
    audioRAF = requestAnimationFrame(tickAudio);
  }

  function startAudioEngine(){
    initAudioEngine();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if(!audioRAF && analyser) audioRAF = requestAnimationFrame(tickAudio);
  }

  function stopAudioEngine(){
    if(audioRAF){ cancelAnimationFrame(audioRAF); audioRAF = null; }
    root.style.setProperty('--audio-bass', '0');
    root.style.setProperty('--audio-mid', '0');
    root.style.setProperty('--audio-treble', '0');
  }

  function syncAmbienceUI(){
    body.classList.toggle('ambience-on', !audio.paused);
    ambienceBtn.classList.toggle('is-on', !audio.paused);
    ambienceBtn.setAttribute('aria-pressed', String(!audio.paused));
    ambienceBtn.setAttribute('aria-label', audio.paused ? 'Play ambient audio' : 'Pause ambient audio');
  }

  function startAmbience(){
    var p;
    try{ p = audio.play(); }catch(e){ p = null; }
    if(p && p.then){
      p.then(function(){ startAudioEngine(); syncAmbienceUI(); })
       .catch(function(){ syncAmbienceUI(); });
    }else{
      syncAmbienceUI();
    }
  }

  function toggleAmbience(){
    if(audio.paused){
      ambienceOn = true;
      localStorage.setItem('shiokaze_ambience', '1');
      startAmbience();
    }else{
      ambienceOn = false;
      localStorage.setItem('shiokaze_ambience', '0');
      audio.pause();
      syncAmbienceUI();
    }
  }

  audio.addEventListener('play', function(){ startAudioEngine(); syncAmbienceUI(); });
  audio.addEventListener('pause', function(){ stopAudioEngine(); syncAmbienceUI(); });
  audio.addEventListener('ended', stopAudioEngine);
  ambienceBtn.addEventListener('click', toggleAmbience);
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) stopAudioEngine();
    else if(!audio.paused) startAudioEngine();
  });
  syncAmbienceUI();

  /* =========================================================
     SOUNDS
     ========================================================= */
  var soundCtx = null;
  var soundEnabled = localStorage.getItem('shiokaze_sound') === '1';

  function ensureSoundCtx(){
    if(!soundCtx){
      try{ soundCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ soundCtx = null; }
    }
    if(soundCtx && soundCtx.state === 'suspended') soundCtx.resume();
    return soundCtx;
  }

  function playTone(freq, duration, gainVal, type){
    if(!soundEnabled) return;
    var ctx = ensureSoundCtx();
    if(!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  var sounds = {
    click:  function(){ playTone(420, 0.06, 0.03, 'triangle'); },
    signal: function(){ playTone(600, 0.08, 0.04, 'sine'); setTimeout(function(){ playTone(900, 0.10, 0.03, 'sine'); }, 70); },
    open:   function(){ playTone(320, 0.10, 0.03, 'sine'); },
    close:  function(){ playTone(220, 0.10, 0.03, 'sine'); },
    error:  function(){ playTone(180, 0.14, 0.04, 'sawtooth'); }
  };

  /* =========================================================
     CLOCK / TZ
     ========================================================= */
  var clockEl = $('clock');
  var tzEl = $('tz');
  try{
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    var city = tz.split('/').pop().replace(/_/g, ' ');
    var mins = -new Date().getTimezoneOffset();
    var sign = mins >= 0 ? '+' : '−';
    var hh = String(Math.floor(Math.abs(mins) / 60)).padStart(2, '0');
    var mm = String(Math.abs(mins) % 60).padStart(2, '0');
    tzEl.textContent = city;
    tzEl.title = city + ' · GMT' + sign + hh + ':' + mm;
  }catch(e){ tzEl.textContent = 'local'; }

  function updateClock(){ clockEl.textContent = new Date().toLocaleTimeString(navigator.language || 'en', { hour12: false }); }
  updateClock();
  setInterval(updateClock, 1000);

  /* =========================================================
     TIME-OF-DAY PALETTE
     ========================================================= */
  var manualTheme = null;
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
  setInterval(applyTimeTheme, 60000);

  /* =========================================================
     LAST.FM — last played / history / top artists
     ========================================================= */
  var musicTitle = $('music-title');
  var npDot = $('np-dot');
  var albumTile = $('album-tile');
  var trackTitle = $('track-title');
  var trackMeta = $('track-meta');
  var trackAlbum = $('track-album');
  var trackState = $('track-state');
  var trackLink = $('track-link');
  var historyList = $('history-list');
  var feedsMeta = $('feeds-meta');
  var artistsList = $('artists-list');
  var watermark = $('player-watermark');
  var artistsMeta = $('artists-meta');

  var MOCK_DATA = {
    'user.getrecenttracks': { recenttracks: { track: [
      { name: 'xtvl', artist: { '#text': 'SVCURA' }, album: { '#text': 'LIVE TRANSMISSION' }, url: 'https://www.last.fm/music/SVCURA/xtvl', date: { uts: String(Math.floor(Date.now()/1000) - 40) }, '@attr': { nowplaying: 'true' }, image: [] },
      { name: 'Snowfall', artist: { '#text': 'Øneheart' }, album: { '#text': 'Snowfall' }, url: 'https://www.last.fm/music/Øneheart/Snowfall', date: { uts: String(Math.floor(Date.now()/1000) - 320) }, image: [] },
      { name: 'Kimi no Kioku', artist: { '#text': 'Shoji Meguro' }, album: { '#text': 'Persona 3 OST' }, url: 'https://www.last.fm/music/Shoji+Meguro/Kimi+no+Kioku', date: { uts: String(Math.floor(Date.now()/1000) - 1500) }, image: [] },
      { name: 'Lullaby', artist: { '#text': 'shiokaze' }, album: { '#text': 'demos' }, url: 'https://www.last.fm/music/shiokaze/Lullaby', date: { uts: String(Math.floor(Date.now()/1000) - 5000) }, image: [] },
      { name: 'Resonance', artist: { '#text': 'HOME' }, album: { '#text': 'Odyssey' }, url: 'https://www.last.fm/music/HOME/Resonance', date: { uts: String(Math.floor(Date.now()/1000) - 9000) }, image: [] }
    ] } },
    'user.gettopartists': { topartists: { artist: [
      { name: 'SVCURA', playcount: '214' },
      { name: 'Øneheart', playcount: '168' },
      { name: 'HOME', playcount: '97' },
      { name: 'Shoji Meguro', playcount: '74' },
      { name: 'Burial', playcount: '61' }
    ] } }
  };

  var lastfmState = { transport: '—', error: '' };

  function lastfmParams(method, extra){
    var q = new URLSearchParams({ method: method, user: CONFIG.lastfm.user, format: 'json' });
    if(extra) for(var k in extra) q.set(k, extra[k]);
    return q;
  }

  // JSONP: last.fm отдаёт CORS-заголовков, поэтому скрипт с callback — самый простой путь
  function lastfmJsonp(method, extra){
    return new Promise(function(resolve, reject){
      var q = lastfmParams(method, extra);
      q.set('api_key', CONFIG.lastfm.apiKey);
      var cb = 'lfm_cb_' + Math.random().toString(36).slice(2);
      var script = document.createElement('script');
      var done = false;
      var timer = setTimeout(function(){ finish(new Error('timeout')); }, 9000);

      function finish(err, data){
        if(done) return;
        done = true;
        clearTimeout(timer);
        try{ delete window[cb]; }catch(e){ window[cb] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
        if(err) reject(err); else resolve(data);
      }

      window[cb] = function(data){ finish(null, data); };
      script.onerror = function(){ finish(new Error('jsonp failed')); };
      q.set('callback', cb);
      script.src = 'https://ws.audioscrobbler.com/2.0/?' + q.toString();
      document.head.appendChild(script);
    });
  }

  function lastfm(method, extra){
    if(!CONFIG.lastfm.user) return Promise.reject(new Error('no user'));
    if(MOCK){ lastfmState.transport = 'demo'; return new Promise(function(res){ setTimeout(function(){ res(MOCK_DATA[method] || {}); }, 450); }); }
    if(CONFIG.lastfm.apiKey){ lastfmState.transport = 'jsonp'; return lastfmJsonp(method, extra); }
    if(CONFIG.lastfm.proxy){ lastfmState.transport = 'proxy'; return fetchJson(CONFIG.lastfm.proxy + '?' + lastfmParams(method, extra).toString()); }
    return Promise.reject(new Error('no transport'));
  }

  function lastfmReason(err){
    var m = String((err && err.message) || '');
    if(m === 'no user') return 'NO USER — SET CONFIG.lastfm.user';
    if(m === 'no transport') return 'SET apiKey OR proxy';
    if(m === 'http 404') return 'PROXY 404 — DEPLOY /lastfm';
    if(m === 'jsonp failed') return 'LAST.FM DID NOT ANSWER';
    if(m === 'timeout') return 'LAST.FM TIMEOUT';
    if(m.indexOf('http ') === 0) return 'LAST.FM ' + m.slice(5);
    return 'LAST.FM UNREACHABLE';
  }

  function emptyState(el, text){
    el.innerHTML = '<div class="widget-empty"><span>' + text + '</span></div>';
  }

  function renderLastPlayed(track){
    var isNow = track && track['@attr'] && track['@attr'].nowplaying === 'true';
    musicTitle.textContent = isNow ? 'now playing' : 'last played';
    npDot.classList.toggle('live', !!isNow);

    if(!track){
      paintTile(albumTile, '', 'shiokaze');
      trackTitle.textContent = 'silence';
      trackMeta.textContent = 'nothing scrobbled yet';
      trackAlbum.textContent = '';
      trackState.textContent = (CONFIG.music === 'listenbrainz' ? 'listenbrainz' : 'last.fm') + ' · empty';
      return;
    }

    var artist = textOf(track.artist) || 'unknown';
    var albumName = textOf(track.album);
    var art = artworkOf(track.image);
    paintTile(albumTile, art, artist);
    if(!art){
      var wanted = track.name;
      fetchArt(track.origin, artist, wanted).then(function(url){
        if(url && trackTitle.textContent === wanted) paintTile(albumTile, url, artist);
      });
    }

    trackTitle.textContent = track.name || '—';
    trackMeta.textContent = artist;
    trackAlbum.textContent = albumName;
    trackState.textContent = isNow ? 'playing now' : (timeAgo(track.date && track.date.uts) || 'recently');

    if(track.url){
      trackLink.href = track.url;
      trackLink.hidden = false;
    }else{
      trackLink.hidden = true;
    }
  }

  function renderHistory(tracks){
    if(!tracks.length){ emptyState(historyList, 'NOTHING SCROBBLED YET'); return; }
    historyList.innerHTML = tracks.map(function(t){
      var artist = textOf(t.artist);
      var image = artworkOf(t.image);
      var mono = monogram(artist);
      var meta = ' data-origin="' + esc(t.origin || '') + '" data-artist="' + esc(artist) +
                 '" data-art-title="' + esc(t.name || '') + '"';
      var tile = image
        ? '<div class="tile"' + meta + '><img src="' + esc(image) + '" alt="" loading="lazy"></div>'
        : '<div class="tile" style="background:' + mono.bg + '"' + meta + '>' + esc(mono.text) + '</div>';
      return '<div class="hist-row">' + tile +
        '<div class="hist-main"><div class="hist-name">' + esc(t.name || '—') + '</div>' +
        '<div class="hist-artist">' + esc(artist) + '</div></div>' +
        '<div class="hist-time">' + esc(timeAgo(t.date && t.date.uts)) + '</div></div>';
    }).join('');
    hydrateArtwork(historyList);
  }

  function renderArtists(artists){
    if(!artists.length){ emptyState(artistsList, 'NO LISTENING DATA'); return; }
    artistsList.innerHTML = artists.map(function(a, i){
      return '<div class="artist-row"><span class="artist-rank">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="artist-name">' + esc(a.name) + '</span>' +
        '<span class="artist-plays">' + esc(a.playcount || '0') + '</span></div>';
    }).join('');
  }

  function notLinked(source){
    musicTitle.textContent = 'last played';
    npDot.classList.remove('live');
    paintTile(albumTile, '', 'shiokaze');
    trackTitle.textContent = (source || 'last.fm') + ' off';
    trackMeta.textContent = 'listening feed not linked';
    trackAlbum.textContent = '';
    trackState.textContent = 'offline';
    trackLink.hidden = true;
    emptyState(historyList, 'NO SIGNAL');
    emptyState(artistsList, 'NO SIGNAL');
    feedsMeta.textContent = source || 'last.fm';
  }

  function loadLastfm(){
    if(!CONFIG.lastfm.user){ notLinked('last.fm'); return; }

    lastfm('user.getrecenttracks', { limit: '12', extended: '1' })
      .then(function(data){
        var raw = data && data.recenttracks && data.recenttracks.track;
        var list = !raw ? [] : (Array.isArray(raw) ? raw : [raw]);
        lastfmState.error = '';
        renderLastPlayed(list[0]);
        var rest = list.filter(function(t){ return !(t['@attr'] && t['@attr'].nowplaying === 'true'); }).slice(0, CONFIG.lastfm.history);
        renderHistory(rest);
        feedsMeta.textContent = '@' + CONFIG.lastfm.user;
      })
      .catch(function(err){
        lastfmState.error = lastfmReason(err);
        musicTitle.textContent = 'last played';
        npDot.classList.remove('live');
        paintTile(albumTile, '', 'shiokaze');
        trackTitle.textContent = 'signal lost';
        trackMeta.textContent = lastfmState.error;
        trackAlbum.textContent = '';
        trackState.textContent = 'offline';
        emptyState(historyList, lastfmState.error);
        feedsMeta.textContent = 'offline';
      });

    lastfm('user.gettopartists', { period: CONFIG.lastfm.period, limit: String(CONFIG.lastfm.artists) })
      .then(function(data){
        var raw = data && data.topartists && data.topartists.artist;
        var list = !raw ? [] : (Array.isArray(raw) ? raw : [raw]);
        renderArtists(list.slice(0, CONFIG.lastfm.artists));
        artistsMeta.textContent = CONFIG.lastfm.period === '7day' ? '7 days' : CONFIG.lastfm.period;
      })
      .catch(function(){ emptyState(artistsList, 'NO SIGNAL'); });
  }

  /* ---- ListenBrainz: тот же виджет, но без ключей и без прокси ---- */
  function lbTrack(listen, isNow){
    var m = listen.track_metadata || {};
    var t = {
      name: m.track_name || '—',
      artist: { '#text': m.artist_name || 'unknown' },
      album: { '#text': m.release_name || '' },
      date: { uts: String(listen.listened_at || Math.floor(Date.now() / 1000)) },
      image: []
    };
    if(isNow) t['@attr'] = { nowplaying: 'true' };
    if(m.additional_info && m.additional_info.recording_mbid){
      t.url = 'https://musicbrainz.org/recording/' + m.additional_info.recording_mbid;
    }
    if(m.additional_info && m.additional_info.origin_url) t.origin = m.additional_info.origin_url;
    if(!t.url && t.origin) t.url = t.origin;
    return t;
  }

  function topFromTracks(list, limit){
    var counts = {};
    list.forEach(function(t){
      var name = primaryArtist(textOf(t.artist));
      if(!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function(name){ return { name: name, playcount: counts[name] }; })
      .sort(function(a, b){ return b.playcount - a.playcount; })
      .slice(0, limit);
  }

  function loadListenBrainz(){
    var user = CONFIG.listenbrainz.user;
    if(!user){ notLinked('listenbrainz'); return; }
    var base = 'https://api.listenbrainz.org/1/user/' + encodeURIComponent(user);
    feedsMeta.textContent = '…';
    Promise.all([
      fetchJson(base + '/listens?count=20', 12000),
      fetchJson(base + '/playing-now', 8000).catch(function(){ return null; })
    ]).then(function(res){
      var listens = (res[0] && res[0].payload && res[0].payload.listens) || [];
      var nowList = (res[1] && res[1].payload && res[1].payload.listens) || [];
      var tracks = listens.map(function(l){ return lbTrack(l, false); });
      var now = nowList[0] ? lbTrack(nowList[0], true) : null;
      if(now) tracks.unshift(now);

      if(!tracks.length){
        renderLastPlayed(null);
        renderHistory([]);
        renderArtists([]);
        feedsMeta.textContent = '@' + user;
        return;
      }

      lastfmState.transport = 'listenbrainz';
      lastfmState.error = '';
      renderLastPlayed(tracks[0]);
      var history = tracks.slice(1, 1 + CONFIG.lastfm.history);
      if(!history.length && now) emptyState(historyList, 'WAITING FOR THE FIRST COMPLETED LISTEN');
      else renderHistory(history);
      renderArtists(topFromTracks(tracks.slice(0, 20), CONFIG.lastfm.artists));
      artistsMeta.textContent = 'recent';
      feedsMeta.textContent = '@' + user;
    }).catch(function(err){
      lastfmState.error = 'LISTENBRAINZ ' + ((err && err.message) || 'ERROR');
      paintTile(albumTile, '', 'shiokaze');
      musicTitle.textContent = 'last played';
      trackTitle.textContent = 'signal lost';
      trackMeta.textContent = lastfmState.error;
      trackAlbum.textContent = '';
      trackState.textContent = 'offline';
      npDot.classList.remove('live');
      emptyState(historyList, lastfmState.error);
      feedsMeta.textContent = 'offline';
    });
  }

  function loadMusic(){
    if(watermark){
      var lb = CONFIG.music === 'listenbrainz';
      watermark.textContent = lb ? 'listenbrainz' : 'last.fm';
      watermark.classList.toggle('is-long', lb);
    }
    if(CONFIG.music === 'listenbrainz') loadListenBrainz();
    else loadLastfm();
  }

  /* ---- обложки: SoundCloud oEmbed, фолбэк iTunes ---- */
  var artMemory = {};
  try{ artMemory = JSON.parse(localStorage.getItem('shiokaze_art') || '{}') || {}; }catch(e){ artMemory = {}; }

  function saveArt(){
    try{
      var keys = Object.keys(artMemory);
      if(keys.length > 220){
        keys.slice(0, keys.length - 220).forEach(function(k){ delete artMemory[k]; });
      }
      localStorage.setItem('shiokaze_art', JSON.stringify(artMemory));
    }catch(e){}
  }

  function artKey(artist, title){
    return (String(artist || '') + '|' + String(title || '')).toLowerCase();
  }

  function soundcloudArt(origin){
    return fetchJson('https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(origin), 9000)
      .then(function(d){
        var url = (d && d.thumbnail_url) || '';
        return url ? url.replace('-large.', '-t500x500.').replace('-t67x67.', '-t500x500.') : '';
      })
      .catch(function(){ return ''; });
  }

  function itunesArt(artist, title){
    var term = encodeURIComponent((artist || '') + ' ' + (title || ''));
    return fetchJson('https://itunes.apple.com/search?term=' + term + '&entity=song&limit=1', 9000)
      .then(function(d){
        var hit = d && d.results && d.results[0];
        var url = hit && hit.artworkUrl100;
        return url ? url.replace('100x100bb', '600x600bb') : '';
      })
      .catch(function(){ return ''; });
  }

  function fetchArt(origin, artist, title){
    var key = artKey(artist, title);
    if(artMemory[key] !== undefined) return Promise.resolve(artMemory[key]);

    var chain = (origin && /soundcloud\.com/.test(origin))
      ? soundcloudArt(origin).then(function(url){ return url || itunesArt(artist, title); })
      : itunesArt(artist, title);

    return chain.then(function(url){
      artMemory[key] = url || '';
      saveArt();
      return url || '';
    }).catch(function(){ return ''; });
  }

  function fillTile(tile, url){
    if(!url) return;
    var img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = function(){ img.remove(); };
    tile.textContent = '';
    tile.style.background = '';
    tile.appendChild(img);
  }

  function hydrateArtwork(scope){
    (scope || document).querySelectorAll('.tile[data-art-title]').forEach(function(tile){
      fetchArt(tile.dataset.origin, tile.dataset.artist, tile.dataset.artTitle)
        .then(function(url){ if(url) fillTile(tile, url); });
    });
  }

  /* =========================================================
     DISCORD PRESENCE — profile avatar, status and rich activity
     ========================================================= */
  var dcName = $('dc-name');
  var dcActivity = $('dc-activity');
  var dcActivityDetail = $('dc-activity-detail');
  var dcActivityMarker = $('dc-activity-marker');
  var dcStatus = $('dc-status');
  var dcStatusLabel = $('dc-status-label');
  var dcPresence = $('discord-presence');

  function setDiscordStatus(status){
    var map = {
      online: { label: 'ONLINE', className: 'online' },
      idle: { label: 'IDLE', className: 'idle' },
      dnd: { label: 'DO NOT DISTURB', className: 'dnd' },
      offline: { label: 'OFFLINE', className: 'offline' }
    };
    var item = map[status] || map.offline;
    if(dcStatus){
      dcStatus.className = 'status-dot ' + item.className;
      dcStatus.setAttribute('aria-label', 'Discord status: ' + item.label);
    }
    if(dcStatusLabel) dcStatusLabel.textContent = item.label;
    if(dcPresence) dcPresence.dataset.status = map[status] ? status : 'offline';
  }

  function setDiscordActivity(primary, detail, marker){
    if(dcActivity) dcActivity.textContent = primary || 'No activity shared';
    if(dcActivityDetail){
      dcActivityDetail.textContent = detail || '';
      dcActivityDetail.hidden = !detail;
    }
    if(dcActivityMarker) dcActivityMarker.textContent = marker || '↳';
  }

  function readLanyard(url){
    var ctrl = new AbortController();
    var timeout = setTimeout(function(){ ctrl.abort(); }, 6500);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then(function(r){
        if(!r.ok) throw new Error('presence HTTP ' + r.status);
        return r.json();
      })
      .then(function(json){
        clearTimeout(timeout);
        if(!json || json.success !== true || !json.data) throw new Error('presence response missing data');
        return json.data;
      }, function(err){
        clearTimeout(timeout);
        throw err;
      });
  }

  function formatActivityDuration(start){
    var stamp = Number(start || 0);
    if(!stamp || !isFinite(stamp)) return '';
    var minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
    if(minutes < 60) return minutes + 'm';
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
  }

  function renderDiscordPresence(data){
    var user = data.discord_user || {};
    dcName.textContent = user.global_name || user.username || 'shiokaze';

    var status = data.discord_status || 'offline';
    setDiscordStatus(status);

    var activities = Array.isArray(data.activities) ? data.activities : [];
    var spotify = data.listening_to_spotify && data.spotify && data.spotify.song ? data.spotify : null;
    if(spotify){
      setDiscordActivity(
        'Listening · ' + spotify.song,
        [spotify.artist, spotify.album && spotify.album !== spotify.song ? spotify.album : ''].filter(Boolean).join(' · '),
        '♫'
      );
      return;
    }

    var act = null;
    var preferredTypes = [0, 2, 1, 3];
    for(var i = 0; i < preferredTypes.length && !act; i++){
      act = activities.filter(function(a){ return a.type === preferredTypes[i]; })[0] || null;
    }

    if(act){
      var verbs = { 0: 'Playing', 1: 'Streaming', 2: 'Listening', 3: 'Watching' };
      var title = act.name || 'Discord activity';
      var primary = (verbs[act.type] || 'Active') + ' · ' + title;
      var extra = [act.details, act.state].filter(Boolean).join(' · ');
      var elapsed = act.timestamps && act.timestamps.start ? formatActivityDuration(act.timestamps.start) : '';
      if(elapsed) extra = extra ? extra + ' · ' + elapsed : elapsed + ' elapsed';
      var marker = act.type === 2 ? '♫' : act.type === 1 ? '↗' : act.type === 3 ? '◉' : '▸';
      setDiscordActivity(primary, extra, marker);
      return;
    }

    var custom = activities.filter(function(a){ return a.type === 4 && a.state; })[0];
    if(custom){
      var emoji = custom.emoji && custom.emoji.name && !custom.emoji.id ? custom.emoji.name + ' ' : '';
      setDiscordActivity(emoji + custom.state, 'Custom status', '·');
      return;
    }

    if(status === 'offline'){
      setDiscordActivity('Offline', 'No live activity', '·');
    }else{
      setDiscordActivity('Online · no activity shared', 'Discord is not publishing a current activity', '·');
    }
  }

  function fetchDiscord(){
    var primaryUrl = CONFIG.discord.proxy + CONFIG.discord.id;
    var backupUrl = 'https://api.lanyard.rest/v1/users/' + CONFIG.discord.id;
    readLanyard(primaryUrl)
      .catch(function(){ return readLanyard(backupUrl); })
      .then(function(data){ renderDiscordPresence(data); })
      .catch(function(){
        setDiscordStatus('offline');
        setDiscordActivity('Presence unavailable', 'Could not reach the Discord status service', '×');
      });
  }

  setDiscordStatus('offline');
  if(dcStatusLabel) dcStatusLabel.textContent = 'CONNECTING';
  if(dcPresence) dcPresence.dataset.status = 'connecting';
  setDiscordActivity('Checking Discord activity…', '', '↳');
  fetchDiscord();
  setInterval(function(){
    if(!document.hidden) fetchDiscord();
  }, matchMedia('(max-width:900px)').matches ? 90000 : 30000);

  /* =========================================================
     SUPABASE / GUESTBOOK / OWNER
     ========================================================= */
  var GUESTBOOK_API = CONFIG.supabase.url;
  var GUESTBOOK_KEY = CONFIG.supabase.key;
  var gbList = $('gb-list');
  var gbCount = $('gb-count');
  var gbForm = $('guestbook-form');
  var gbNameInput = $('gb-name-input');
  var gbInput = $('gb-message');
  var gbWebsite = $('gb-website');
  var gbSubmit = $('gb-submit');
  var visitCount = $('visit-count');
  var ratingStars = $('rating-stars');
  var ratingValue = $('rating-value');

  function fmtDate(v){
    try{ return new Date(v).toLocaleDateString(navigator.language || 'en'); }catch(e){ return ''; }
  }

  function api(path, options, token){
    options = options || {};
    var ctrl = new AbortController();
    var timeout = setTimeout(function(){ ctrl.abort(); }, 8000);
    var headers = {
      apikey: GUESTBOOK_KEY,
      'Content-Type': 'application/json'
    };
    if(token) headers.Authorization = 'Bearer ' + token;
    if(options.headers) for(var k in options.headers) headers[k] = options.headers[k];
    return fetch(GUESTBOOK_API + path, {
      method: options.method,
      body: options.body,
      signal: ctrl.signal,
      headers: headers
    }).then(function(r){
      return r.json().catch(function(){ return null; }).then(function(data){
        clearTimeout(timeout);
        if(!r.ok) throw new Error((data && (data.message || data.hint || data.error_description)) || 'request failed');
        return data;
      });
    });
  }

  var authorSession = null;
  var ownerModal = $('owner-modal');
  var ownerOpen = $('owner-login-open');
  var ownerForm = $('owner-login-form');
  var authorEmailInput = $('author-email');
  var authorPasswordInput = $('author-password');
  var authorLogout = $('author-logout');
  var authorSessionLabel = $('author-session');
  var authorLoginError = $('author-login-error');

  function syncOwnerUI(){
    var on = !!authorSession;
    body.classList.toggle('author-mode', on);
    authorLogout.hidden = !on;
    authorSessionLabel.hidden = !on;
    authorEmailInput.hidden = on;
    authorPasswordInput.hidden = on;
    ownerForm.querySelector('button[type="submit"]').hidden = on;
  }

  function renderMessages(items){
    if(!Array.isArray(items) || !items.length){
      gbCount.textContent = '0';
      gbList.innerHTML = '<div class="gb-empty">NO SIGNALS YET — BE THE FIRST.</div>';
      return;
    }
    gbCount.textContent = String(items.length);
    gbList.innerHTML = items.map(function(m){
      var liked = !!m.author_liked;
      var reply = m.author_reply
        ? '<div class="gb-reply"><div class="gb-reply__label">AUTHOR TRANSMISSION</div><div class="gb-reply__text">' + esc(m.author_reply) + '</div>' + (m.author_reply_at ? '<div class="gb-reply__date">' + fmtDate(m.author_reply_at) + '</div>' : '') + '</div>'
        : '';
      var ownerControls = authorSession
        ? '<div class="gb-author-actions"><button class="gb-like-btn ' + (liked ? 'author-active' : '') + '" type="button" data-like="' + esc(m.id) + '" aria-label="' + (liked ? 'Unlike' : 'Like') + '">' + (liked ? '♥ LIKED' : '♥ LIKE') + '</button></div>'
        : '';
      var replyEditor = authorSession
        ? '<div class="gb-reply-editor"><textarea data-reply-input="' + esc(m.id) + '" maxlength="500" placeholder="reply...">' + esc(m.author_reply || '') + '</textarea><button type="button" data-reply="' + esc(m.id) + '">' + (m.author_reply ? 'UPDATE' : 'REPLY') + '</button></div>'
        : '';
      return '<article class="gb-message"><div class="gb-top"><span class="gb-name">' + esc(m.name) + (liked ? '<span class="gb-author-badge">♥ AUTHOR</span>' : '') + '</span><span class="gb-date">' + fmtDate(m.created_at) + '</span></div><div class="gb-text">' + esc(m.message) + '</div>' + (m.contact ? '<div class="gb-contact">' + esc(m.contact) + '</div>' : '') + reply + '<div class="gb-message__bottom">' + ownerControls + '</div>' + replyEditor + '</article>';
    }).join('');
  }

  function loadMessages(){
    api('/rest/v1/guestbook_comments?select=id,name,contact,message,created_at,author_liked,author_reply,author_reply_at&order=created_at.desc&limit=50')
      .then(function(data){ renderMessages(data); })
      .catch(function(){
        return api('/rest/v1/guestbook_comments?select=id,name,contact,message,created_at,author_liked&order=created_at.desc&limit=50')
          .then(function(data){ renderMessages((data || []).map(function(x){ x.author_reply = null; x.author_reply_at = null; return x; })); });
      })
      .catch(function(){
        gbList.innerHTML = '<div class="gb-error">GUESTBOOK OFFLINE</div>';
        gbCount.textContent = '—';
      });
  }

  gbForm.addEventListener('submit', function(e){
    e.preventDefault();
    if(gbWebsite.value) return;
    var lastSend = Number(localStorage.getItem('gb_last_send') || 0);
    var wait = 30000 - (Date.now() - lastSend);
    if(wait > 0){ showToast('WAIT ' + Math.ceil(wait / 1000) + 'S'); return; }
    var name = (gbNameInput.value.trim() || 'visitor').slice(0, 32);
    var message = gbInput.value.trim().slice(0, 160);
    if(!message){ showToast('WRITE A MESSAGE FIRST'); gbInput.focus(); return; }
    gbSubmit.disabled = true;
    api('/rest/v1/guestbook_comments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name: name, contact: null, message: message })
    }).then(function(){
      localStorage.setItem('gb_last_send', String(Date.now()));
      gbNameInput.value = '';
      gbInput.value = '';
      showToast('SIGNAL SENT');
      if(sounds.signal) sounds.signal();
      return loadMessages();
    }).catch(function(){
      showToast('SEND FAILED');
    }).then(function(){
      gbSubmit.disabled = false;
    });
  });

  gbList.addEventListener('click', function(e){
    var like = e.target.closest('[data-like]');
    var reply = e.target.closest('[data-reply]');
    if(!authorSession) return;
    if(like){
      like.disabled = true;
      api('/rest/v1/rpc/toggle_author_like', { method: 'POST', body: JSON.stringify({ p_comment_id: like.dataset.like }) }, authorSession.access_token)
        .then(loadMessages)
        .catch(function(){ showToast('LIKE FAILED'); })
        .then(function(){ like.disabled = false; });
      return;
    }
    if(reply){
      var id = reply.dataset.reply;
      var inputEl = null;
      var all = gbList.querySelectorAll('[data-reply-input]');
      for(var i = 0; i < all.length; i++){ if(all[i].dataset.replyInput === id){ inputEl = all[i]; break; } }
      var text = inputEl ? inputEl.value.trim() : '';
      if(!text) return;
      reply.disabled = true;
      api('/rest/v1/rpc/set_author_reply', { method: 'POST', body: JSON.stringify({ p_comment_id: id, p_reply: text }) }, authorSession.access_token)
        .then(function(){ showToast('REPLY SENT'); return loadMessages(); })
        .catch(function(){ showToast('REPLY NOT ENABLED'); })
        .then(function(){ reply.disabled = false; });
    }
  });

  ownerOpen.addEventListener('click', function(){ ownerModal.hidden = false; authorLoginError.textContent = ''; });
  ownerModal.addEventListener('click', function(e){
    if(e.target.matches('[data-owner-close]') || e.target.classList.contains('owner-modal__backdrop')) ownerModal.hidden = true;
  });
  authorLogout.addEventListener('click', function(){
    authorSession = null;
    localStorage.removeItem('shiokaze_author_session');
    syncOwnerUI();
    loadMessages();
    ownerModal.hidden = true;
  });
  ownerForm.addEventListener('submit', function(e){
    e.preventDefault();
    authorLoginError.textContent = '';
    api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: authorEmailInput.value.trim(), password: authorPasswordInput.value || '' })
    }).then(function(d){
      if(!d || !d.access_token) throw new Error('LOGIN FAILED');
      authorSession = d;
      localStorage.setItem('shiokaze_author_session', JSON.stringify(d));
      ownerModal.hidden = true;
      syncOwnerUI();
      return loadMessages();
    }).catch(function(err){
      authorLoginError.textContent = err.message || 'LOGIN FAILED';
    });
  });
  try{
    var saved = JSON.parse(localStorage.getItem('shiokaze_author_session') || 'null');
    if(saved && saved.access_token && saved.expires_at && saved.expires_at * 1000 > Date.now()) authorSession = saved;
    else if(saved) localStorage.removeItem('shiokaze_author_session');
  }catch(e){}
  syncOwnerUI();
  setInterval(function(){
    if(authorSession && authorSession.expires_at && authorSession.expires_at * 1000 <= Date.now()){
      authorSession = null;
      localStorage.removeItem('shiokaze_author_session');
      syncOwnerUI();
      showToast('SESSION EXPIRED');
    }
  }, 60000);

  /* =========================================================
     VISITS / RATING
     ========================================================= */
  function visitorKey(){
    var k = localStorage.getItem('shiokaze_visitor_id');
    if(k) return k;
    k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    localStorage.setItem('shiokaze_visitor_id', k);
    return k;
  }

  function loadSiteStats(){
    var id = visitorKey();
    api('/rest/v1/rpc/register_site_visit', { method: 'POST', body: JSON.stringify({ p_visitor_id: id }) })
      .then(function(visit){
        if(visit && typeof visit === 'object') visitCount.textContent = String(visit.visits || visit.total_visits || '—');
        return api('/rest/v1/rpc/get_site_stats');
      })
      .then(function(stats){
        if(stats){
          visitCount.textContent = String(stats.total_visits || stats.visits || visitCount.textContent);
          ratingValue.textContent = stats.average_rating ? Number(stats.average_rating).toFixed(1) : '—';
        }
      })
      .catch(function(){ visitCount.textContent = '—'; ratingValue.textContent = '—'; });
  }

  var savedRating = Number(localStorage.getItem('shiokaze_rating') || 0);
  function paintRating(value){
    var btns = ratingStars.querySelectorAll('button');
    for(var i = 0; i < btns.length; i++){
      var n = Number(btns[i].dataset.rating);
      btns[i].classList.toggle('is-active', n <= value);
      btns[i].setAttribute('aria-checked', n === value ? 'true' : 'false');
    }
  }
  paintRating(savedRating);

  ratingStars.addEventListener('click', function(e){
    var b = e.target.closest('[data-rating]');
    if(!b) return;
    var rating = Number(b.dataset.rating);
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    localStorage.setItem('shiokaze_rating', String(rating));
    paintRating(rating);
    api('/rest/v1/rpc/submit_site_rating', { method: 'POST', body: JSON.stringify({ p_visitor_id: visitorKey(), p_rating: rating }) })
      .then(function(){ return loadSiteStats(); })
      .then(function(){ showToast('RATING SAVED'); })
      .catch(function(){ showToast('RATING OFFLINE'); });
  });

  ratingStars.addEventListener('keydown', function(e){
    var buttons = Array.prototype.slice.call(ratingStars.querySelectorAll('button'));
    var i = buttons.indexOf(document.activeElement);
    if(i < 0) return;
    if(e.key === 'ArrowRight' || e.key === 'ArrowUp'){ e.preventDefault(); buttons[Math.min(buttons.length - 1, i + 1)].focus(); }
    if(e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ e.preventDefault(); buttons[Math.max(0, i - 1)].focus(); }
  });

  document.querySelectorAll('[data-copy-email]').forEach(function(a){
    a.addEventListener('click', function(e){
      if(!navigator.clipboard) return;
      e.preventDefault();
      navigator.clipboard.writeText(a.dataset.copyEmail)
        .then(function(){ showToast('EMAIL COPIED'); })
        .catch(function(){ window.location.href = a.href; });
    });
  });

  /* =========================================================
     CONSOLE
     ========================================================= */
  var consoleOverlay = $('console-overlay');
  var consoleOutput = $('console-output');
  var consoleInput = $('console-input');
  var consoleTrigger = $('console-trigger');
  var consoleOpen = false;

  function cLog(text, cls){
    var line = document.createElement('div');
    line.className = 'line' + (cls ? ' ' + cls : '');
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function openConsole(){
    if(consoleOpen) return;
    consoleOpen = true;
    consoleOverlay.classList.add('is-open');
    consoleOverlay.setAttribute('aria-hidden', 'false');
    body.classList.add('console-open');
    if(sounds.open) sounds.open();
    setTimeout(function(){ consoleInput.focus(); }, 80);
    if(!consoleOutput.children.length){
      cLog('SVCURA / TERMINAL v1.1', 'accent');
      cLog('type "help" for available commands', 'dim');
      cLog('—', 'dim');
    }
  }

  function closeConsole(){
    if(!consoleOpen) return;
    consoleOpen = false;
    consoleOverlay.classList.remove('is-open');
    consoleOverlay.setAttribute('aria-hidden', 'true');
    body.classList.remove('console-open');
    if(sounds.close) sounds.close();
  }

  consoleTrigger.addEventListener('click', function(e){
    e.preventDefault();
    if(consoleOpen) closeConsole(); else openConsole();
  });

  function processCommand(raw){
    var input = raw.trim();
    if(!input) return;
    cLog(input, 'cmd');
    var parts = input.toLowerCase().split(/\s+/);
    var cmd = parts[0];
    var arg = parts.slice(1).join(' ');

    switch(cmd){
      case 'help':
        cLog('available commands:', 'accent');
        cLog('  help              — this list');
        cLog('  ambience on/off   — background audio');
        cLog('  source lastfm|lb  — переключить источник музыки');
        cLog('  refresh           — перезагрузить музыку/сообщения');
        cLog('  lastfm            — listening widget status');
        cLog('  theme dark        — dark theme');
        cLog('  theme light       — light theme');
        cLog('  theme auto        — follow time of day');
        cLog('  sound on          — enable UI sounds');
        cLog('  sound off         — disable UI sounds');
        cLog('  stats             — site stats');
        cLog('  whoami            — visitor info');
        cLog('  time              — current time');
        cLog('  clear             — clear');
        cLog('  close / exit      — close terminal');
        break;
      case 'ambience':
      case 'music':
        if(arg === 'on' || arg === 'play'){ if(audio.paused) toggleAmbience(); cLog('ambience on', 'ok'); }
        else if(arg === 'off' || arg === 'pause'){ if(!audio.paused) toggleAmbience(); cLog('ambience off', 'ok'); }
        else cLog('usage: ambience on | off', 'err');
        break;
      case 'source':
        if(arg === 'lastfm' || arg === 'listenbrainz'){
          CONFIG.music = arg;
          loadMusic();
          cLog('source: ' + arg, 'ok');
        } else {
          cLog('source: ' + CONFIG.music + ' (usage: source lastfm | listenbrainz)', 'accent');
        }
        break;
      case 'lastfm':
        cLog('— music source: ' + CONFIG.music + ' —', 'accent');
        cLog('user:      ' + (CONFIG.music === 'listenbrainz'
          ? (CONFIG.listenbrainz.user || '(set CONFIG.listenbrainz.user)')
          : (CONFIG.lastfm.user || '(set CONFIG.lastfm.user)')));
        cLog('transport: ' + lastfmState.transport + (CONFIG.lastfm.apiKey ? ' (api key set)' : ' (no api key)'));
        cLog('proxy:     ' + CONFIG.lastfm.proxy);
        cLog('error:     ' + (lastfmState.error || 'none'));
        cLog('card:      ' + (trackTitle.textContent || '—') + ' / ' + (trackState.textContent || '—'));
        if(CONFIG.music === 'listenbrainz' && !CONFIG.listenbrainz.user) cLog('→ set CONFIG.listenbrainz.user (или ?lb=ник)', 'err');
        else if(CONFIG.music === 'lastfm' && !CONFIG.lastfm.user) cLog('→ set CONFIG.lastfm.user (или ?lastfm=ник)', 'err');
        else if(lastfmState.error) cLog('→ ' + lastfmState.error, 'err');
        else cLog('ok', 'ok');
        break;
      case 'refresh':
        loadMusic();
        loadMessages();
        cLog('refreshed', 'ok');
        break;
      case 'characters':
        var missing = [];
        document.querySelectorAll('.char').forEach(function(fig){
          if(!fig.classList.contains('has-art')) missing.push(fig.dataset.name);
        });
        cLog(missing.length ? 'missing art: ' + missing.join(', ') : 'both characters loaded', missing.length ? 'err' : 'ok');
        break;
      case 'theme':
        if(arg === 'dark' || arg === 'light' || arg === 'auto'){
          setThemeMode(arg);
          cLog('theme: ' + arg + (arg === 'auto' ? ' (time-of-day)' : ''), 'ok');
        }else cLog('usage: theme dark | light | auto', 'err');
        break;
      case 'sound':
        if(arg === 'on'){
          soundEnabled = true;
          localStorage.setItem('shiokaze_sound', '1');
          ensureSoundCtx();
          cLog('sound enabled', 'ok');
          setTimeout(function(){ playTone(880, 0.06, 0.04); }, 50);
        } else if(arg === 'off'){
          soundEnabled = false;
          localStorage.setItem('shiokaze_sound', '0');
          cLog('sound disabled', 'ok');
        } else cLog('usage: sound on | off', 'err');
        break;
      case 'stats':
        cLog('— site statistics —', 'accent');
        cLog('views:  ' + (visitCount.textContent || '—'));
        cLog('rating: ' + (ratingValue.textContent || '—'));
        cLog('time:   ' + new Date().toLocaleString());
        break;
      case 'whoami':
        cLog('— visitor info —', 'accent');
        cLog('browser: ' + navigator.userAgent.split(') ')[0].split(' (')[0]);
        cLog('language: ' + (navigator.language || '—'));
        cLog('screen: ' + window.screen.width + '×' + window.screen.height);
        cLog('viewport: ' + window.innerWidth + '×' + window.innerHeight);
        cLog('timezone: ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '—'));
        break;
      case 'time': cLog(new Date().toString(), 'accent'); break;
      case 'clear': consoleOutput.innerHTML = ''; break;
      case 'close':
      case 'exit': closeConsole(); break;
      default:
        cLog('unknown command: ' + cmd + ' — try "help"', 'err');
        if(sounds.error) sounds.error();
    }
  }

  window.addEventListener('keydown', function(e){
    if(e.code === 'Backquote' || e.key === '~' || e.key === '`' || e.key === 'Ё' || e.key === 'ё'){
      var ae = document.activeElement;
      var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
      if(typing && ae !== consoleInput) return;
      e.preventDefault();
      if(consoleOpen) closeConsole(); else openConsole();
      return;
    }
    if(e.key === 'Escape' && consoleOpen){
      e.preventDefault();
      closeConsole();
    }
  });

  consoleInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){
      e.preventDefault();
      var val = consoleInput.value;
      consoleInput.value = '';
      processCommand(val);
    }
    if(e.key === 'Escape'){ e.preventDefault(); closeConsole(); }
  });

  /* =========================================================
     CURSOR (visual only; CSS keeps the native cursor)
     ========================================================= */
  var ring = $('cursor-ring');
  var trail = $('cursor-trail');
  var glyph = ring ? ring.querySelector('.cursor-glyph') : null;
  var hasHover = matchMedia('(hover:hover)').matches;
  var anyFine = matchMedia('(any-pointer:fine)').matches;
  var enableCustom = hasHover || anyFine;
  var mx = window.innerWidth / 2, my = window.innerHeight / 2, tx = mx, ty = my, rafId = null, idleTimer = null;

  function placeCursor(){
    if(!ring) return;
    ring.style.left = mx + 'px';
    ring.style.top = my + 'px';
    if(trail){ trail.style.left = tx + 'px'; trail.style.top = ty + 'px'; }
  }

  function frame(){
    rafId = null;
    if(!enableCustom) return;
    mx += (tx - mx) * 0.35;
    my += (ty - my) * 0.35;
    placeCursor();
    if(Math.abs(tx - mx) > 0.3 || Math.abs(ty - my) > 0.3) rafId = requestAnimationFrame(frame);
  }

  function wakeCursor(){
    if(document.hidden || !enableCustom) return;
    if(!rafId) rafId = requestAnimationFrame(frame);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function(){
      mx = tx; my = ty; placeCursor();
      if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    }, 200);
  }

  if(enableCustom && ring){ root.classList.add('has-custom-cursor'); placeCursor(); }

  window.addEventListener('mousemove', function(e){
    tx = e.clientX; ty = e.clientY;
    if(enableCustom && ring){
      wakeCursor();
      var nx = (tx / window.innerWidth - .5) * 2;
      var ny = (ty / window.innerHeight - .5) * 2;
      root.style.setProperty('--mx', String(nx));
      root.style.setProperty('--my', String(ny));
    }
  }, { passive: true });

  window.addEventListener('pointerdown', function(){
    var stage = $('stage');
    if(!stage || !stage.animate) return;
    stage.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.9985)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' }
    );
  }, { passive: true });


  /* =========================================================
     TABS (history / messages) + character slots
     ========================================================= */
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var tabPanels = { history: $('panel-history'), messages: $('panel-messages') };

  function setTab(name){
    tabButtons.forEach(function(btn){
      var on = btn.dataset.tab === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });
    Object.keys(tabPanels).forEach(function(key){
      if(tabPanels[key]) tabPanels[key].hidden = key !== name;
    });
    updateTabGlider();
  }

  tabButtons.forEach(function(btn, i){
    btn.addEventListener('click', function(){ setTab(btn.dataset.tab); });
    btn.addEventListener('keydown', function(e){
      if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = (i + (e.key === 'ArrowRight' ? 1 : tabButtons.length - 1)) % tabButtons.length;
      tabButtons[next].focus();
      setTab(tabButtons[next].dataset.tab);
    });
  });

  // Artwork is optional; a missing image quietly falls back to its placeholder slot.
  document.querySelectorAll('.char img').forEach(function(img){
    function mark(ok){
      var fig = img.closest('.char');
      if(fig) fig.classList.toggle('has-art', ok);
    }
    img.addEventListener('load', function(){ mark(img.naturalWidth > 1); });
    img.addEventListener('error', function(){ mark(false); });
    if(img.complete) mark(img.naturalWidth > 1);
  });


  /* =========================================================
     VISUAL DETAILS — light, choreography, tab glider
     ========================================================= */
  var pointerRaf = null, pointerCard = null, pointerX = 0, pointerY = 0;

  document.addEventListener('pointermove', function(e){
    var target = e.target && e.target.closest ? e.target.closest('.card') : null;
    if(!target) return;
    pointerCard = target; pointerX = e.clientX; pointerY = e.clientY;
    if(pointerRaf) return;
    pointerRaf = requestAnimationFrame(function(){
      pointerRaf = null;
      if(!pointerCard) return;
      var rect = pointerCard.getBoundingClientRect();
      pointerCard.style.setProperty('--px', (pointerX - rect.left).toFixed(1) + 'px');
      pointerCard.style.setProperty('--py', (pointerY - rect.top).toFixed(1) + 'px');
    });
  }, { passive: true });

  function updateTabGlider(){
    var glider = document.querySelector('.tab-glider');
    var active = document.querySelector('.tab.is-active');
    if(!glider || !active) return;
    glider.style.width = active.offsetWidth + 'px';
    glider.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }

  // «дешифровка» текста — маленькая отсылка к терминалу
  function scrambleText(el, target, duration){
    var glyphs = '!<>-_\\/[]{}—=+*^?#';
    var start = performance.now();
    var len = target.length;
    function frame(now){
      var p = Math.min(1, (now - start) / duration);
      var revealed = Math.floor(p * len);
      var out = target.slice(0, revealed);
      for(var i = revealed; i < len; i++){
        out += target.charAt(i) === ' ' ? ' ' : glyphs.charAt(Math.floor(Math.random() * glyphs.length));
      }
      el.textContent = out;
      if(p < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  var nameEl = document.querySelector('.profile-name');
  if(nameEl){
    var nameText = nameEl.textContent;
    var nameBusy = false;
    nameEl.addEventListener('pointerenter', function(){
      if(nameBusy || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      nameBusy = true;
      scrambleText(nameEl, nameText, 520);
      setTimeout(function(){ nameBusy = false; }, 900);
    });
  }

  function startChoreo(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ document.body.classList.add('choreo'); });
    });
  }

  window.addEventListener('resize', function(){ updateTabGlider(); });

  /* =========================================================
     BOOT
     ========================================================= */
  loadMessages();
  loadSiteStats();
  loadMusic();
  requestAnimationFrame(updateTabGlider);
  setTimeout(updateTabGlider, 400);

  setInterval(function(){ if(!document.hidden) loadMessages(); }, 60000);
  setInterval(function(){ if(!document.hidden) loadMusic(); }, 45000);

  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){
      loadMessages();
      loadSiteStats();
      loadMusic();
      wakeCursor();
    }
  });

})();
