// NEON DRIFT — entry point. Wires renderer + audio + director, runs the loop.
import { Renderer } from "./gl.js";
import { AudioEngine } from "./audio.js";
import { Director } from "./director.js";

const canvas = document.getElementById("gl");
const startEl = document.getElementById("start");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const scrollerWrap = document.getElementById("scroller-wrap");
const scrollerEl = document.getElementById("scroller");
const nowPlaying = document.getElementById("now-playing");

const GREETINGS =
  "NEON DRIFT — a webgl demo by claude code  ***  greetings fly out to the demoscene, " +
  "the shader wizards, the chiptune heroes and everyone still coding pixels at 4am  ***  " +
  "drop your own track into the window to make it pump  ***  stay neon  ***  ";
scrollerEl.textContent = GREETINGS.repeat(2);

let renderer, audio, director;
let t0 = 0;
let running = false;

// dev/kiosk helpers: ?autostart skips the click, ?t=SECONDS jumps into the timeline
const params = new URLSearchParams(location.search);
const timeOffset = parseFloat(params.get("t") || "0") || 0;

function init() {
  renderer = new Renderer(canvas);
  audio = new AudioEngine();
  director = new Director();
  window.addEventListener("resize", () => renderer.resize());
}

async function begin() {
  if (running) return;
  running = true;
  const timeout = new Promise((res) => setTimeout(res, 1500));
  try { await Promise.race([audio.start(), timeout]); }
  catch (e) { console.warn("Audio konnte nicht starten, Visuals laufen trotzdem:", e); }
  startEl.style.opacity = "0";
  setTimeout(() => (startEl.style.display = "none"), 600);
  t0 = performance.now() - timeOffset * 1000;
  requestAnimationFrame(frame);
}

function frame(now) {
  const time = (now - t0) / 1000;
  const levels = audio.getLevels();
  const state = director.update(time);

  renderer.setUniforms({
    uTime: time,
    uBass: levels.bass,
    uMid: levels.mid,
    uTreble: levels.treble,
    uBeat: levels.beat,
    ...state.uniforms,
  });
  renderer.render();

  // overlays
  titleEl.style.opacity = state.overlay.title.toFixed(3);
  subtitleEl.style.opacity = state.overlay.subtitle.toFixed(3);
  scrollerWrap.style.opacity = state.overlay.scroller.toFixed(3);

  // scrolling marquee
  const ww = window.innerWidth;
  const sw = scrollerEl.scrollWidth / 2; // we doubled the text
  const x = ww - ((time * 180) % (sw)); // px/sec, wraps over one copy
  scrollerEl.style.transform = `translateX(${x}px)`;

  requestAnimationFrame(frame);
}

// ---- drag & drop: load a user track ----
function setupDnD() {
  const show = (on) => document.body.classList.toggle("dragging", on);
  window.addEventListener("dragover", (e) => { e.preventDefault(); show(true); });
  window.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null) show(false);
  });
  window.addEventListener("drop", async (e) => {
    e.preventDefault(); show(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("audio")) return;
    if (!running) await begin();
    await audio.loadFile(file);
    nowPlaying.textContent = "♪ " + audio.trackName;
    nowPlaying.style.opacity = "1";
  });
}

init();
setupDnD();
startEl.addEventListener("click", begin);
window.addEventListener("keydown", (e) => { if (e.key === " ") begin(); });
if (params.has("autostart")) begin();
