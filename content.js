// YT NonStop — evita la pausa "Video en pausa. ¿Quieres seguir viendo?"
// Corre en el "MAIN world" de la página para poder tocar variables internas de YouTube.
(() => {
  'use strict';
  if (window.__ytNonstopLoaded) return;
  window.__ytNonstopLoaded = true;

  // ---- Ajustes: si YouTube cambia su HTML, actualiza estos selectores ----
  const DIALOG_SELECTORS = [
    'yt-confirm-dialog-renderer',   // youtube.com
    'ytmusic-you-there-renderer',   // music.youtube.com
  ];
  const CONFIRM_SELECTORS = ['#confirm-button button', '#confirm-button', 'button'];
  const LACT_REFRESH_MS = 60 * 1000;   // cada cuánto se "simula" actividad
  const POLL_MS = 5 * 1000;            // revisión periódica de respaldo
  const MIN_IDLE_MS = 5 * 60 * 1000;   // solo actúa si no tocaste la pestaña en 5 min
  const TAG = '[yt-nonstop]';

  const log = (...args) => console.log(TAG, ...args);
  let lastUserInput = Date.now();
  let lastActionAt = 0;

  // Registrar interacción real (isTrusted) para no interferir con tus propias pausas o diálogos.
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(type, (e) => {
      if (e.isTrusted) lastUserInput = Date.now();
    }, { capture: true, passive: true });
  }

  // ---- Estrategia 1: prevenir (refresca la marca de "última actividad" de YouTube) ----
  let lactMissingLogged = false;
  setInterval(() => {
    if (typeof window._lact === 'number') {
      window._lact = Date.now();
    } else if (!lactMissingLogged) {
      lactMissingLogged = true;
      log('_lact no existe en esta página; queda solo la estrategia reactiva');
    }
  }, LACT_REFRESH_MS);

  // ---- Estrategia 2: reaccionar (responde el diálogo y reanuda el video) ----
  const isVisible = (el) => el.isConnected && el.getClientRects().length > 0;

  function findDialog() {
    for (const sel of DIALOG_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (isVisible(el)) return el;
      }
    }
    return null;
  }

  function tryResume(reason) {
    const now = Date.now();
    if (now - lastUserInput < MIN_IDLE_MS) return false;
    if (now - lastActionAt < 2000) return false;
    const dialog = findDialog();
    if (!dialog) return false;
    lastActionAt = now;

    let button = null;
    for (const sel of CONFIRM_SELECTORS) {
      button = dialog.querySelector(sel);
      if (button) break;
    }
    button?.click();

    // Con la pestaña oculta el clic puede no reanudar nada, así que se reanuda directo.
    const video = document.querySelector('video');
    if (video?.paused) {
      video.play().catch((err) => log('play() falló:', err?.message ?? err));
    }
    log(`aviso de inactividad respondido (${reason})${button ? '' : ' — sin botón, solo play()'}`);
    return true;
  }

  // 'pause' no burbujea: se escucha en fase de captura.
  document.addEventListener('pause', (e) => {
    if (!(e.target instanceof HTMLVideoElement)) return;
    if (tryResume('pause')) return;
    // El diálogo puede renderizarse un poco después de la pausa.
    for (const delay of [500, 1500, 4000]) {
      setTimeout(() => tryResume(`pause+${delay}ms`), delay);
    }
  }, true);

  setInterval(() => tryResume('revisión periódica'), POLL_MS);

  log('activo en', location.hostname);
})();
