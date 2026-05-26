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

Eine Multi-Part-Timeline (loopt endlos, 162s):

1. **Intro** (0–12s) — Sterne, Titel glüht rein
2. **Nebula Flight** (12–28s) — Flug durch driftende Nebula, erste Gel-Bubbles
3. **Gel Bubbles** (28–48s) — transparente, glasige Metaballs, langsam wabernd
4. **Outrun Floor** (48–70s) — Synthwave-Gitterboden + Neon-Sonne
5. **Neon Tunnel** (70–90s) — Flug durch eine Neon-Gitter-Röhre
6. **Mega Structure** (90–114s) — gigantische rotierende Tron-Gitterkugel + Ring
7. **Kaleidoscope** (114–136s) — gespiegelte Mandala-Psychedelik
8. **Laser Finale** (136–162s) — Laser-Salven, Regenbogen-Greetings-Scroller

Audio: Bass pumpt die Bubbles, Höhen triggern Laser, Beat treibt Glow &
Chromatic Aberration, **Drops** (Spectral-Flux-Erkennung) lösen Flashes &
Glitches aus. Zwischen den Parts gibt's **Glitch/RGB-Shift-Übergänge** und
die ganze Pipeline läuft mit **Motion-Blur-Trails**.

## Steuerung

| Taste | Funktion |
|-------|----------|
| `F` | Vollbild an/aus |
| `← / →` | 10s in der Timeline zurück/vor springen |
| `H` | UI/Overlays aus- und einblenden |
| `+ / -` | Render-Auflösung hoch/runter (Performance) |
| Maus | leichtes Parallax-Tilt der Kamera |

Die Auflösung skaliert zudem **automatisch**, um ~55fps zu halten.

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
