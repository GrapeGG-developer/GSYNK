/* GrapeScript — логотип .lottie в правом нижнем углу.
   Читает настоящий dotLottie (zip с manifest.json + animations/*.json):
   распаковывает архив в браузере (fflate), подставляет картинки и играет через lottie-web.
   Чтобы поставить СВОЙ оригинал логотипа — просто замени файл assets/grapescript.lottie,
   ничего в коде трогать не нужно. Если анимация не загрузилась, остаётся статичный PNG. */
(function () {
  'use strict';

  var css = '' +
    '#grapescript-badge{position:fixed;right:16px;bottom:16px;z-index:2147483000;' +
    'width:clamp(148px,20vw,204px);padding:8px 10px 6px;border-radius:18px;' +
    'background:rgba(10,7,24,.72);border:1px solid rgba(139,92,246,.45);' +
    'box-shadow:0 10px 32px rgba(0,0,0,.55),0 0 0 1px rgba(34,211,238,.12) inset,0 0 22px rgba(124,58,237,.28);' +
    'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}' +
    '#grapescript-badge .gs-lottie{width:100%;aspect-ratio:3/1;line-height:0;}' +
    '#grapescript-badge .gs-lottie svg{width:100%!important;height:100%!important;}' +
    '#grapescript-badge img.gs-fallback{width:100%;height:auto;display:block;}' +
    '#grapescript-badge .gs-caption{display:block;text-align:center;margin-top:2px;' +
    'font:600 9px/1.2 "Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8e86a8;}' +
    '@media (max-width:520px){#grapescript-badge{right:10px;bottom:10px;width:132px;padding:6px 8px 4px}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function ensureBadge() {
    var badge = document.getElementById('grapescript-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'grapescript-badge';
      badge.setAttribute('role', 'img');
      badge.setAttribute('aria-label', 'GrapeScript');
      badge.title = 'GrapeScript';
      badge.innerHTML =
        '<div class="gs-lottie" aria-hidden="true"></div>' +
        '<img class="gs-fallback" src="assets/grapescript.png" alt="GrapeScript" width="1080" height="360">' +
        '<span class="gs-caption">powered by GrapeScript</span>';
      document.body.appendChild(badge);
    }
    return badge;
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function mimeOf(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
  }

  function findFile(files, candidates) {
    var keys = Object.keys(files);
    for (var c = 0; c < candidates.length; c++) {
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === candidates[c].toLowerCase()) return keys[k];
      }
    }
    return null;
  }

  function play(container, fallback, animationData) {
    if (typeof window.lottie === 'undefined') return false;
    try {
      var anim = window.lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animationData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });
      anim.addEventListener('DOMLoaded', function () {
        if (fallback) fallback.style.display = 'none';
        window.__gsLottieLoaded = true;
      });
      anim.addEventListener('data_failed', function () {
        if (fallback) fallback.style.display = 'block';
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    var badge = ensureBadge();
    var container = badge.querySelector('.gs-lottie');
    var fallback = badge.querySelector('img.gs-fallback');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof window.fetch === 'undefined') return; // останется PNG
    var url = badge.getAttribute('data-lottie') || 'assets/grapescript.lottie';

    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('lottie http ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      // вдруг под именем .lottie лежит обычный Lottie JSON
      if (bytes[0] === 0x7b) {
        play(container, fallback, JSON.parse(new TextDecoder().decode(bytes)));
        return;
      }
      if (typeof window.fflate === 'undefined') throw new Error('нет распаковщика');
      var files = window.fflate.unzipSync(bytes);
      var animationId = null;
      var manifestKey = findFile(files, ['manifest.json']);
      if (manifestKey) {
        try {
          var manifest = JSON.parse(new TextDecoder().decode(files[manifestKey]));
          if (manifest.animations && manifest.animations[0]) animationId = manifest.animations[0].id;
          if (manifest.initial && manifest.initial.animationId) animationId = manifest.initial.animationId;
        } catch (e) { /* манифест битый — найдём анимацию сами */ }
      }
      var candidates = [];
      if (animationId) candidates.push('animations/' + animationId + '.json', animationId + '.json');
      Object.keys(files).forEach(function (k) {
        if (/\.json$/i.test(k) && !/manifest\.json$/i.test(k)) candidates.push(k);
      });
      var animKey = findFile(files, candidates);
      if (!animKey) throw new Error('анимация в архиве не найдена');
      var data = JSON.parse(new TextDecoder().decode(files[animKey]));
      // внешние картинки анимации -> встроенные data: URI из того же архива
      (data.assets || []).forEach(function (asset) {
        if (!asset.p || asset.e === 1 || /^data:/.test(asset.p)) return;
        var key = findFile(files, [(asset.u || '') + asset.p, asset.p, 'images/' + asset.p]);
        if (key) {
          asset.p = 'data:' + mimeOf(asset.p) + ';base64,' + bytesToBase64(files[key]);
          asset.u = '';
          asset.e = 1;
        }
      });
      if (!play(container, fallback, data)) throw new Error('плеер недоступен');
    }).catch(function () {
      /* тихо остаёмся на статичном PNG — логотип всё равно в углу */
      if (fallback) fallback.style.display = 'block';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
