// Timeline director: maps elapsed time -> per-scene shader weights + overlay state.
// Loops every LOOP seconds and is endlessly runnable.
//
// Parts:
//   1 Intro          0 - 12   stars + title
//   2 Nebula Flight 12 - 26   nebula, first gel bubbles
//   3 Gel Bubbles   26 - 44   glassy metaballs
//   4 Figure Flight 44 - 74   fly through an endless field of neon shapes
//   5 Outrun Floor  74 - 94   synthwave grid floor + neon sun
//   6 Neon Tunnel   94 -112   grid tunnel flight
//   7 Mega Structure112-134   giant rotating grid-sphere + ring
//   8 Kaleidoscope 134 -154   mirrored psychedelia
//   9 Laser Finale 154 -178   lasers + greetings scroller

const LOOP = 178.0;

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function seg(t, start, end, fade) {
  return smoothstep(start, start + fade, t) * (1 - smoothstep(end - fade, end, t));
}

export class Director {
  update(time) {
    const t = time % LOOP;

    const fade = smoothstep(0, 2.5, t) * (1 - smoothstep(LOOP - 2.5, LOOP, t));

    const stars = 0.4 + 0.6 * (1 - smoothstep(12, 20, t));
    const nebula = clamp01(seg(t, 10, 44, 5) + seg(t, 132, LOOP, 5));
    const bubbles = clamp01(seg(t, 22, 44, 6) + seg(t, 132, 176, 6));
    const figures = seg(t, 44, 74, 5);
    const floor = seg(t, 74, 94, 4);
    const tunnel = seg(t, 94, 112, 4);
    const mega = seg(t, 112, 134, 5);
    const kaleido = seg(t, 134, 154, 5);
    const lasers = seg(t, 150, 176, 4);

    // motion-blur trails: light at the start, heavier through the spectacle parts
    const trail = clamp01(0.5 + 0.32 * Math.max(figures * 0.6, tunnel, mega * 0.7, kaleido, lasers));

    const finale = smoothstep(150, 174, t);
    const camSpeed = 1.1 + smoothstep(22, 44, t) * 0.5 + finale * 3.0;

    const title = seg(t, 2.0, 11.0, 2.0);
    const subtitle = seg(t, 4.0, 11.0, 2.0);
    const scroller = seg(t, 154.0, LOOP - 2.0, 3.0);

    return {
      uniforms: {
        uStars: stars,
        uNebula: nebula,
        uBubbles: bubbles,
        uFigures: figures,
        uFloor: floor,
        uTunnel: tunnel,
        uMega: mega,
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
