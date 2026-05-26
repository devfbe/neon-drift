// Timeline director: maps elapsed time -> per-scene shader weights + overlay state.
// Loops every LOOP seconds and is endlessly runnable.
//
// One journey through all worlds:
//    1 Intro           0 - 10   stars + title
//    2 Nebula Flight  10 - 24   forward-flight through nebula, first gel bubbles
//    3 Gel Bubbles    24 - 38   clear glass metaballs
//    4 Figure Flight  38 - 58   field of neon shapes
//    5 City Flyover   58 - 76   neon city
//    6 Wormhole       76 - 92   twisting tunnel
//    7 Tentacle Field 92 -110   waving neon columns
//    8 Outrun Floor  110 -126   synthwave grid + sun
//    9 Neon Tunnel   126 -142   grid tunnel
//   10 Wireframe     142 -158   vector object
//   11 Mega Structure158 -178   grid-sphere, rings, moons
//   12 Mandelbox     178 -196   fractal temple
//   13 Kaleidoscope  196 -210   mirrored psychedelia (bubbles + nebula)
//   14 Laser Finale  210 -228   lasers + greetings scroller

const LOOP = 228.0;

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function seg(t, start, end, fade) {
  return smoothstep(start, start + fade, t) * (1 - smoothstep(end - fade, end, t));
}

export class Director {
  update(time) {
    const t = time % LOOP;

    const fade = smoothstep(0, 2.5, t) * (1 - smoothstep(LOOP - 2.5, LOOP, t));

    // background layers
    const stars = 0.4 + 0.6 * (1 - smoothstep(10, 18, t));
    const nebula = clamp01(seg(t, 8, 40, 5) + seg(t, 194, LOOP, 5));
    const bubbles = clamp01(seg(t, 22, 40, 5) + seg(t, 194, 226, 5));

    // the journey — one scene at a time, crossfading
    const figures = seg(t, 38, 58, 4);
    const city = seg(t, 58, 76, 4);
    const worm = seg(t, 76, 92, 4);
    const tentacle = seg(t, 92, 110, 4);
    const floor = seg(t, 110, 126, 4);
    const tunnel = seg(t, 126, 142, 4);
    const wire = seg(t, 142, 158, 4);
    const mega = seg(t, 158, 178, 5);
    const mandel = seg(t, 178, 196, 4);
    const kaleido = seg(t, 196, 210, 4);
    const lasers = seg(t, 206, 226, 4);

    // motion-blur trails: light early, heavier through the spectacle parts
    const trail = clamp01(0.5 + 0.32 * Math.max(
      figures * 0.6, worm, tunnel, mega * 0.7, mandel * 0.5, kaleido, lasers));

    const finale = smoothstep(206, 224, t);
    const camSpeed = 1.1 + smoothstep(22, 40, t) * 0.5 + finale * 3.0;

    const title = seg(t, 2.0, 9.0, 2.0);
    const subtitle = seg(t, 4.0, 9.0, 2.0);
    const scroller = seg(t, 210.0, LOOP - 2.0, 3.0);

    return {
      uniforms: {
        uStars: stars,
        uNebula: nebula,
        uBubbles: bubbles,
        uFigures: figures,
        uCity: city,
        uWorm: worm,
        uTentacle: tentacle,
        uFloor: floor,
        uTunnel: tunnel,
        uWire: wire,
        uMega: mega,
        uMandel: mandel,
        uKaleido: kaleido,
        uLasers: lasers,
        uTrail: trail,
        uCamSpeed: camSpeed,
        uFade: fade,
      },
      overlay: { title, subtitle, scroller },
    };
  }
}
