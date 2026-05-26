// Timeline director: maps elapsed time -> per-scene shader weights + overlay state.
// Loops every LOOP seconds and is endlessly runnable.
//
// Parts:
//   1 Intro          0 - 12   stars + title
//   2 Nebula Flight 12 - 28   nebula, first gel bubbles
//   3 Gel Bubbles   28 - 48   glassy metaballs
//   4 Outrun Floor  48 - 70   synthwave grid floor + neon sun
//   5 Neon Tunnel   70 - 90   grid tunnel flight
//   6 Mega Structure90 -114   giant rotating grid-sphere + ring
//   7 Kaleidoscope 114 -136   mirrored psychedelia
//   8 Laser Finale 136 -162   lasers + greetings scroller

const LOOP = 162.0;

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
    const nebula = clamp01(seg(t, 10, 48, 5) + seg(t, 112, LOOP, 5));
    const bubbles = clamp01(seg(t, 24, 48, 6) + seg(t, 112, 160, 6));
    const floor = seg(t, 48, 70, 4);
    const tunnel = seg(t, 70, 90, 4);
    const mega = seg(t, 90, 114, 5);
    const kaleido = seg(t, 114, 136, 5);
    const lasers = seg(t, 132, 160, 4);

    // motion-blur trails: light at the start, heavier through the spectacle parts
    const trail = clamp01(0.5 + 0.32 * Math.max(tunnel, mega * 0.7, kaleido, lasers));

    const finale = smoothstep(132, 156, t);
    const camSpeed = 1.1 + smoothstep(24, 44, t) * 0.5 + finale * 3.0;

    const title = seg(t, 2.0, 11.0, 2.0);
    const subtitle = seg(t, 4.0, 11.0, 2.0);
    const scroller = seg(t, 136.0, LOOP - 2.0, 3.0);

    return {
      uniforms: {
        uStars: stars,
        uNebula: nebula,
        uBubbles: bubbles,
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
