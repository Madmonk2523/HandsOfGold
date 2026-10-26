(() => {
  'use strict';
  const video = document.getElementById('hog-mini-video');
  const play = document.getElementById('hog-mini-play');
  const sound = document.getElementById('hog-mini-sound');
  const start = document.getElementById('hog-mini-start');
  if (!video || !play || !sound || !start) return;
  video.controls = false;
  video.defaultMuted = false;
  video.muted = false;
  video.volume = 1;
  document.querySelector('.hog-mini-controls').hidden = false;
  function update() {
    play.textContent = video.paused ? 'Play' : 'Pause';
    play.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    sound.textContent = video.muted ? 'Sound on' : 'Mute';
    sound.setAttribute('aria-label', video.muted ? 'Turn video sound on' : 'Mute video');
    sound.setAttribute('aria-pressed', String(!video.muted));
    if (!video.paused) start.hidden = true;
  }
  function begin() {
    return video.play().then(() => { start.hidden = true; update(); }).catch(() => { start.hidden = false; update(); });
  }
  start.addEventListener('click', () => { video.muted = false; begin(); });
  play.addEventListener('click', () => { if (video.paused) begin(); else video.pause(); });
  sound.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) begin();
    update();
  });
  ['play', 'pause', 'volumechange'].forEach(event => video.addEventListener(event, update));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.autoplay = false;
    video.pause();
    start.hidden = false;
  } else begin();
  update();
})();
