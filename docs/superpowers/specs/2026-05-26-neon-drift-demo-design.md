# NEON DRIFT — WebGL Demoscene Demo (Design)

**Datum:** 2026-05-26
**Status:** Approved

## Ziel

Eine browserbasierte Demoscene-Demo im Neon-Cyberpunk-Stil: audio-reaktiv,
als Multi-Part-Timeline mit Greetings-Scroller. Maximal authentischer
Demoscene-Look über einen Fullscreen-Raymarching-Fragment-Shader.

## Tech-Entscheidungen

- **Plattform:** Single-Page WebGL2-Demo, kein Framework, kein Build-Step,
  null externe Dependencies. Reines HTML/CSS/JS + GLSL.
- **Rendering:** Fullscreen-Fragment-Shader (Raymarching, ShaderToy-Stil) +
  Post-Processing-Pass.
- **Stil:** Neon Cyberpunk — Magenta/Cyan/Electric-Blue, dunkler Space,
  viel Glow.
- **Audio:** Voll reaktiv via Web Audio API (FFT-Analyse). Platzhalter-Beat
  synthetisiert; echter Track per Drag&Drop nachladbar.
- **Struktur:** Multi-Part-Demo mit überblendeten Szenen + Scroller.

## Architektur

```
index.html ── canvas (WebGL2) + "Click to start"-Overlay
  ├─ js/director.js   → Timeline, Part-Übergänge, Scroller-Text
  ├─ js/audio.js      → Web Audio: Analyser (Bass/Mid/Treble + Beat),
  │                     synth. Platzhalter-Beat, Drag&Drop-Loader
  ├─ js/gl.js         → WebGL2-Setup, Shader-Compile, Render-Loop,
  │                     Uniform-Bridge, Framebuffer für Post-Pass
  ├─ shaders/demo.frag → Raymarcher: Nebula, Metaball-Bubbles, Laser, Stars
  └─ shaders/post.frag → Bloom/Glow, Chromatic Aberration, Vignette, Grain
```

### Datenfluss

1. `audio.js` liefert pro Frame geglättete Werte: `bass`, `mid`, `treble`,
   `beat` (0..1) und `time`.
2. `director.js` berechnet aus `time` den aktiven Part + Blend-Faktoren und
   Szenen-Parameter.
3. `gl.js` schreibt alles als Uniforms in `demo.frag`, rendert in einen
   Framebuffer, dann `post.frag` auf den Screen.

## Komponenten (jeweils isoliert, klare Schnittstelle)

- **audio.js** — `init()`, `getLevels() → {bass,mid,treble,beat}`,
  `loadFile(file)`, `start()`. Abhängig von: Web Audio API.
- **gl.js** — `init(canvas)`, `setUniforms(obj)`, `render()`,
  `resize()`. Abhängig von: WebGL2, Shader-Quellen.
- **director.js** — `update(time, levels) → uniformsObj`. Reine Logik,
  keine GL-/Audio-Abhängigkeit (testbar in Isolation).
- **demo.frag / post.frag** — reine GLSL, kommunizieren nur über Uniforms.

## Effekte (im Raymarcher)

- **Nebula:** volumetrischer fbm-Noise (mehrere Oktaven), magenta/cyan,
  langsamer Drift; Dichte/Helligkeit ∝ Mitten.
- **Gel-Bubbles:** Metaballs via smooth-min-SDF, sin/noise-moduliertes
  Wabern, glasig + Fresnel + Neon-Refraktion; Größe ∝ Bass.
- **Laser:** scharfe additive Beams, Salven getriggert durch Treble/Beat.
- **Starfield:** parallaktische Sternenschicht mit Twinkle.
- **Camera:** sanfter Flight-Path, beschleunigt zum Finale.

## Parts (Timeline)

1. **Intro** (0–15s): Schwarz → Sterne → Titel „NEON DRIFT" glüht rein.
2. **Nebula Flight** (15–40s): Flug durch Nebula, erste Bubbles.
3. **Bubble Chaos** (40–65s): Metaballs dominieren, pumpen zum Bass.
4. **Laser Finale** (65–90s): Laser-Salven, Kamera beschleunigt → Greetings.
5. **Loop/Outro:** zurück zum Intro (endlos lauffähig).

Scroller: klassischer Sine-Bobbing-Schriftzug. Umsetzung (DOM-Overlay vs.
im Shader) wird bei der Implementierung nach Optik entschieden.

## Audio-Pipeline

`AnalyserNode` → FFT → 3 geglättete Bänder + Beat-Detektor (Bass-Peak via
gleitendem Schwellwert). Platzhalter: synth. 4/4-Beat (Kick-Oszillator +
Hi-Hat-Noise). Drag&Drop-Zone ersetzt Platzhalter live durch echtes
WAV/MP3. Start hinter „Click to start"-Overlay (Autoplay-Policy).

## Preview & Verify

Lokaler Server (`python3 -m http.server 8080`). User öffnet
`localhost:8080`. Verifikation per Headless-Chrome: Screenshots +
Console-Errors prüfen, dass WebGL kompiliert und rendert. Audio testet
der User im echten Browser.

## Scope-Grenzen (YAGNI)

Kein Build-Tool, kein TypeScript, keine externen Libs, kein Mobile-Tuning,
keine Settings-UI. Nur Demo + Track-Loader.

## Erfolgskriterien

- Läuft flüssig (~60fps Desktop) im aktuellen Chrome/Firefox.
- Alle 4 Parts blenden sauber ineinander, Demo loopt endlos.
- Sichtbare Audio-Reaktion: Bubbles pumpen zum Bass, Laser zum Treble.
- Echter Track per Drag&Drop ladbar, ersetzt Platzhalter ohne Reload.
- Keine WebGL-Compile- oder JS-Konsolen-Fehler.
