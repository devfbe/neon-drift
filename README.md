# NEON DRIFT

Eine audio-reaktive WebGL-Demoscene-Demo im Neon-Cyberpunk-Stil. Reines
HTML/CSS/JS + GLSL — kein Build-Step, keine Dependencies.

## Starten

```sh
python3 -m http.server 8080
# dann http://localhost:8080 im Browser öffnen, "Click to start" drücken
```

Beim Start läuft ein synthetisierter Platzhalter-Beat. **Zieh ein WAV/MP3
ins Browserfenster**, um deinen eigenen Track laufen zu lassen — die ganze
Demo (Bubbles, Laser, Nebula) reagiert in Echtzeit darauf.

## Die Demo

Eine Multi-Part-Timeline (loopt endlos, 90s):

1. **Intro** — Sterne, Titel glüht rein
2. **Nebula Flight** — Flug durch driftende Nebula, erste Gel-Bubbles
3. **Bubble Chaos** — glasige Metaballs, pumpen zum Bass
4. **Laser Finale** — Laser-Salven zum Treble, Greetings-Scroller

Audio: Bass pumpt die Bubbles, Höhen triggern Laser, Beat treibt Glow &
Chromatic Aberration.

## Dev-/Kiosk-Parameter

- `?autostart` — überspringt das Klick-Overlay (z.B. für Kiosk-Mode)
- `?t=SECONDS` — springt direkt an die Stelle der Timeline (zum Testen)

z.B. `http://localhost:8080/?autostart&t=50`

## Aufbau

| Datei | Aufgabe |
|-------|---------|
| `index.html` | Canvas, Overlays (Titel/Scroller), Start-Screen |
| `js/main.js` | Wiring, Render-Loop, Drag&Drop |
| `js/gl.js` | WebGL2-Renderer (Szene → Framebuffer → Post-Pass) |
| `js/audio.js` | Web-Audio: FFT-Analyse, Platzhalter-Beat, File-Loader |
| `js/director.js` | Timeline → Part-Gewichte + Overlay-Zustand |
| `js/shaders.js` | GLSL: Raymarcher + Post-Processing |

Design-Doc: `docs/superpowers/specs/2026-05-26-neon-drift-demo-design.md`
