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
  "NEON DRIFT — a webgl demo by DEVFBE  ***  code & visuals: devfbe  ***  " +
  "greetings fly out to the demoscene, the shader wizards, the chiptune heroes " +
  "and everyone still coding pixels at 4am  ***  " +
  "drop your own track into the window to make it pump  ***  stay neon — devfbe  ***  ";

// build per-letter spans (doubled so the marquee wraps seamlessly)
const spans = [];
for (const ch of (GREETINGS + GREETINGS)) {
  const s = document.createElement("span");
  s.textContent = ch === " " ? " " : ch;
  s.style.display = "inline-block";
  scrollerEl.appendChild(s);
  spans.push(s);
}

let renderer, audio, director;
let t0 = 0;
let running = false;
let crtOn = false;

const params = new URLSearchParams(location.search);
const timeOffset = parseFloat(params.get("t") || "0") || 0;

// mouse parallax (smoothed)
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("mousemove", (e) => {
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
});

// perf auto-scaling
let frames = 0, dtAccum = 0, lastFrame = 0;

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
  if (audio.trackName) {
    nowPlaying.textContent = "♪ " + audio.trackName;
    nowPlaying.style.opacity = "1";
  }
  t0 = performance.now() - timeOffset * 1000;
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

// debug: ?scene=NAME isolates one scene at full weight (for verifying new scenes)
const SCENE_WEIGHTS = ["uStars", "uNebula", "uBubbles", "uFigures", "uFloor",
  "uTunnel", "uMega", "uKaleido", "uLasers", "uCity", "uWorm", "uTentacle",
  "uMandel", "uWire"];
const SCENE_ALIAS = { city: "uCity", worm: "uWorm", wormhole: "uWorm",
  tentacle: "uTentacle", mandel: "uMandel", mandelbox: "uMandel", wire: "uWire",
  figures: "uFigures", mega: "uMega", tunnel: "uTunnel", floor: "uFloor",
  nebula: "uNebula", bubbles: "uBubbles", kaleido: "uKaleido" };
const forcedScene = SCENE_ALIAS[params.get("scene")] || null;

function frame(now) {
  const time = (now - t0) / 1000;
  const levels = audio.getLevels();
  const state = director.update(time);

  // smooth mouse
  mouse.x += (mouse.tx - mouse.x) * 0.08;
  mouse.y += (mouse.ty - mouse.y) * 0.08;

  const u = {
    uTime: time,
    uBass: levels.bass,
    uMid: levels.mid,
    uTreble: levels.treble,
    uBeat: levels.beat,
    uDrop: levels.drop,
    uMouse: [mouse.x, mouse.y],
    uCrt: crtOn ? 1 : 0,
    ...state.uniforms,
  };
  if (forcedScene) {
    for (const k of SCENE_WEIGHTS) u[k] = 0;
    u[forcedScene] = 1;
    u.uFade = 1;
  }
  renderer.setUniforms(u);
  renderer.render();

  // overlays
  titleEl.style.opacity = state.overlay.title.toFixed(3);
  subtitleEl.style.opacity = state.overlay.subtitle.toFixed(3);
  const so = state.overlay.scroller;
  scrollerWrap.style.opacity = so.toFixed(3);

  // marquee + per-letter rainbow wave (only when visible)
  if (so > 0.01) {
    const sw = scrollerEl.scrollWidth / 2;
    const x = window.innerWidth - ((time * 180) % sw);
    scrollerEl.style.transform = `translateX(${x}px)`;
    for (let i = 0; i < spans.length; i++) {
      const y = Math.sin(time * 4 + i * 0.35) * 9;
      const hue = (time * 70 + i * 9) % 360;
      spans[i].style.transform = `translateY(${y.toFixed(1)}px)`;
      spans[i].style.color = `hsl(${hue},100%,66%)`;
    }
  }

  // perf auto-scaling: nudge internal resolution to hold ~55fps
  const dt = now - lastFrame; lastFrame = now;
  dtAccum += dt; frames++;
  if (frames >= 90) {
    const avg = dtAccum / frames;
    if (avg > 22 && renderer.scale > 0.5) renderer.setScale(renderer.scale - 0.25);
    else if (avg < 17 && renderer.scale < 1) renderer.setScale(renderer.scale + 0.25);
    frames = 0; dtAccum = 0;
  }

  requestAnimationFrame(frame);
}

// ---- drag & drop: load a user track ----
function setupDnD() {
  const show = (on) => document.body.classList.toggle("dragging", on);
  window.addEventListener("dragover", (e) => { e.preventDefault(); show(true); });
  window.addEventListener("dragleave", (e) => { if (e.relatedTarget === null) show(false); });
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

// ---- hotkeys ----
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case " ": if (!running) begin(); break;
    case "f": case "F": toggleFullscreen(); break;
    case "ArrowRight": t0 -= 10000; break;          // skip +10s
    case "ArrowLeft": t0 += 10000; break;           // back 10s
    case "h": case "H": document.body.classList.toggle("hide-ui"); break;
    case "c": case "C": crtOn = !crtOn; break;
    case "+": case "=": renderer.setScale(renderer.scale + 0.25); break;
    case "-": renderer.setScale(renderer.scale - 0.25); break;
  }
});

init();
setupDnD();
startEl.addEventListener("click", begin);
if (params.has("autostart")) begin();
