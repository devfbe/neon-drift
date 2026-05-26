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

Eine Multi-Part-Timeline (loopt endlos, 178s):

1. **Intro** (0–12s) — Sterne, Titel glüht rein
2. **Nebula Flight** (12–26s) — Flug durch driftende Nebula, erste Gel-Bubbles
3. **Gel Bubbles** (26–44s) — wenige klare Glas-Gel-Bubbles, langsam wabernd
4. **Figure Flight** (44–74s) — Durchflug durch ein endloses Feld glühender Neon-Figuren (Kugeln, Würfel, Tori, Kristalle), Banking-Kamera
5. **Outrun Floor** (74–94s) — Synthwave-Gitterboden + Neon-Sonne
6. **Neon Tunnel** (94–112s) — Flug durch eine Neon-Gitter-Röhre
7. **Mega Structure** (112–134s) — gigantische rotierende Tron-Gitterkugel + Ring
8. **Kaleidoscope** (134–154s) — gespiegelte Mandala-Psychedelik
9. **Laser Finale** (154–178s) — Laser-Salven, Regenbogen-Greetings-Scroller

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
