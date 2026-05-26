# NEON DRIFT

Eine audio-reaktive WebGL-Demoscene-Demo im Neon-Cyberpunk-Stil. Reines
HTML/CSS/JS + GLSL — kein Build-Step, keine Dependencies.

## Starten

```sh
python3 -m http.server 8080
# dann http://localhost:8080 im Browser öffnen, "Click to start" drücken
```

Beim Start läuft der eingebackene Track (`assets/track.ogg`). Du kannst
jederzeit **ein eigenes WAV/MP3 ins Browserfenster ziehen**, um es zu
ersetzen — die ganze Demo reagiert in Echtzeit darauf. (Fällt der Default-
Track aus, springt ein synthetisierter Beat als Fallback ein.)

## Die Demo

Eine Multi-Part-Timeline (loopt endlos, 150s):

1. **Intro** (0–12s) — Sterne, Titel glüht rein
2. **Nebula Flight** (12–30s) — Flug durch driftende Nebula, erste Gel-Bubbles
3. **Gel Bubbles** (30–52s) — transparente, glasige Metaballs, langsam wabernd
4. **Neon Tunnel** (52–74s) — Flug durch eine Neon-Gitter-Röhre
5. **Mega Structure** (74–100s) — gigantische rotierende Tron-Gitterkugel + Ring
6. **Kaleidoscope** (100–124s) — gespiegelte Mandala-Psychedelik
7. **Laser Finale** (124–150s) — Laser-Salven, Greetings-Scroller

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
