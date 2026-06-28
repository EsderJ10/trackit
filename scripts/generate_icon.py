#!/usr/bin/env python3
"""
Trackit app-icon generator.

Draws a geometric flat-shape MEERKAT mascot (the sentinel animal, standing
upright "keeping watch") on a deep-purple-glow background, and exports every
icon asset the Expo app needs.

Renderer: pycairo (vector, antialiased, gradients + beziers).
Run:  python3 scripts/generate_icon.py
Outputs are written (overwritten) into ./assets/.

Everything is built from two reusable primitives so all assets stay
visually consistent:
    draw_background(ctx, size)         -> deep-purple radial gradient
    draw_meerkat(ctx, cx, cy, scale, mono=False, glow=False)

We render at 4x supersampling with cairo, then downscale with Pillow for
crisp antialiasing.
"""

import math
import os

import cairo
from PIL import Image

# ----------------------------------------------------------------------------
# Palette
# ----------------------------------------------------------------------------
BG       = (0x1C / 255, 0x18 / 255, 0x33 / 255)   # deep purple bg
SURF_HI  = (0x3A / 255, 0x34 / 255, 0x68 / 255)   # lifted surface (gradient center)

AMBER    = (0xE4 / 255, 0xAC / 255, 0x63 / 255)   # primary body
CORAL    = (0xEC / 255, 0x6A / 255, 0x8C / 255)   # accent (eye shine etc.)
BELLY    = (0xF3 / 255, 0xD3 / 255, 0xA3 / 255)   # soft warm cream belly patch
WARM_DK  = (0xC9 / 255, 0x7A / 255, 0x4A / 255)   # warm shadow blocking
AMBER_LT = (0xF2 / 255, 0xC8 / 255, 0x92 / 255)   # light amber highlight

DEEP     = (0x25 / 255, 0x21 / 255, 0x47 / 255)   # eyes / nose / outline
MID      = (0x41 / 255, 0x3F / 255, 0x87 / 255)   # mid structural detail
GLOW     = (0x7B / 255, 0x8A / 255, 0xE6 / 255)   # soft glow halo

WHITE    = (1.0, 1.0, 1.0)

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

SS = 4  # supersampling factor


# ----------------------------------------------------------------------------
# Small geometry helpers
# ----------------------------------------------------------------------------
def set_src(ctx, rgb, a=1.0):
    ctx.set_source_rgba(rgb[0], rgb[1], rgb[2], a)


def ellipse(ctx, cx, cy, rx, ry):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(rx, ry)
    ctx.arc(0, 0, 1, 0, 2 * math.pi)
    ctx.restore()


def fill_ellipse(ctx, cx, cy, rx, ry, rgb, a=1.0):
    set_src(ctx, rgb, a)
    ellipse(ctx, cx, cy, rx, ry)
    ctx.fill()


# ----------------------------------------------------------------------------
# Background
# ----------------------------------------------------------------------------
def draw_background(ctx, size):
    """Deep purple radial gradient: lifted in the center, darker at the edges."""
    grad = cairo.RadialGradient(
        size * 0.5, size * 0.42, size * 0.05,
        size * 0.5, size * 0.5, size * 0.72,
    )
    grad.add_color_stop_rgb(0.0, *SURF_HI)
    grad.add_color_stop_rgb(0.55, *_mix(SURF_HI, BG, 0.6))
    grad.add_color_stop_rgb(1.0, *_mix(BG, (0.08, 0.06, 0.16), 0.5))
    ctx.set_source(grad)
    ctx.rectangle(0, 0, size, size)
    ctx.fill()


def _mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


# ----------------------------------------------------------------------------
# The meerkat
# ----------------------------------------------------------------------------
def draw_meerkat(ctx, cx, cy, scale, mono=False, glow=False):
    """
    Draw an upright sentinel meerkat centered horizontally on cx, vertically
    arranged around cy. `scale` ~ overall height in pixels of the figure.

    mono=True  -> flat white silhouette (Android themed icon)
    glow=True  -> draw a soft glow halo behind the figure first
    """
    s = scale

    # color resolver: in mono mode everything collapses to white
    def C(rgb):
        return WHITE if mono else rgb

    # ----- soft glow halo behind the mascot --------------------------------
    if glow and not mono:
        g = cairo.RadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.62)
        g.add_color_stop_rgba(0.0, *GLOW, 0.32)
        g.add_color_stop_rgba(0.6, *GLOW, 0.12)
        g.add_color_stop_rgba(1.0, *GLOW, 0.0)
        ctx.set_source(g)
        ellipse(ctx, cx, cy, s * 0.6, s * 0.62)
        ctx.fill()

    # Reference frame: figure spans roughly y in [cy - 0.55s , cy + 0.5s]
    head_cy = cy - 0.40 * s
    body_cy = cy + 0.10 * s

    # ===================== MONOCHROME SILHOUETTE ==========================
    # Build one unified silhouette so the themed icon reads as a single shape.
    if mono:
        _meerkat_silhouette(ctx, cx, cy, s)
        # Punch the signature eye-mask + nose back out as transparent holes so
        # the themed icon still reads as a meerkat face, not a blob.
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_CLEAR)
        for sgn in (-1, 1):
            ellipse(ctx, cx + sgn * 0.095 * s, head_cy - 0.01 * s, 0.075 * s, 0.085 * s)
            ctx.fill()
        # nose dot
        ellipse(ctx, cx, head_cy + 0.07 * s, 0.045 * s, 0.04 * s)
        ctx.fill()
        ctx.restore()
        return

    # ===================== TAIL (behind body) =============================
    # long thin curving tail to the lower-right, with a dark tip.
    ctx.move_to(cx + 0.10 * s, body_cy + 0.20 * s)
    ctx.curve_to(
        cx + 0.34 * s, body_cy + 0.30 * s,
        cx + 0.50 * s, body_cy + 0.18 * s,
        cx + 0.46 * s, body_cy - 0.05 * s,
    )
    ctx.curve_to(
        cx + 0.43 * s, body_cy - 0.20 * s,
        cx + 0.33 * s, body_cy - 0.10 * s,
        cx + 0.30 * s, body_cy + 0.02 * s,
    )
    ctx.curve_to(
        cx + 0.27 * s, body_cy + 0.14 * s,
        cx + 0.22 * s, body_cy + 0.18 * s,
        cx + 0.10 * s, body_cy + 0.20 * s,
    )
    ctx.close_path()
    set_src(ctx, C(WARM_DK))
    ctx.fill()
    # dark tail tip
    fill_ellipse(ctx, cx + 0.45 * s, body_cy - 0.10 * s, 0.05 * s, 0.07 * s, C(DEEP))

    # ===================== HIND FEET ======================================
    for sgn in (-1, 1):
        fill_ellipse(ctx, cx + sgn * 0.12 * s, cy + 0.50 * s,
                     0.10 * s, 0.05 * s, C(DEEP))

    # ===================== BODY (pear/torso) ==============================
    # Upright torso: narrow at shoulders, wide at the seated belly.
    ctx.move_to(cx - 0.16 * s, body_cy - 0.18 * s)        # left shoulder
    ctx.curve_to(
        cx - 0.30 * s, body_cy + 0.02 * s,
        cx - 0.30 * s, body_cy + 0.30 * s,
        cx - 0.14 * s, body_cy + 0.42 * s,                 # left hip
    )
    ctx.curve_to(
        cx - 0.04 * s, body_cy + 0.49 * s,
        cx + 0.04 * s, body_cy + 0.49 * s,
        cx + 0.14 * s, body_cy + 0.42 * s,                 # right hip
    )
    ctx.curve_to(
        cx + 0.30 * s, body_cy + 0.30 * s,
        cx + 0.30 * s, body_cy + 0.02 * s,
        cx + 0.16 * s, body_cy - 0.18 * s,                 # right shoulder
    )
    ctx.curve_to(
        cx + 0.08 * s, body_cy - 0.30 * s,
        cx - 0.08 * s, body_cy - 0.30 * s,
        cx - 0.16 * s, body_cy - 0.18 * s,
    )
    ctx.close_path()
    set_src(ctx, C(AMBER))
    ctx.fill()

    # belly patch (soft warm cream) - smaller oval, lower-centered chest/tummy
    ctx.move_to(cx, body_cy - 0.06 * s)
    ctx.curve_to(
        cx + 0.115 * s, body_cy + 0.02 * s,
        cx + 0.115 * s, body_cy + 0.26 * s,
        cx, body_cy + 0.34 * s,
    )
    ctx.curve_to(
        cx - 0.115 * s, body_cy + 0.26 * s,
        cx - 0.115 * s, body_cy + 0.02 * s,
        cx, body_cy - 0.06 * s,
    )
    ctx.close_path()
    set_src(ctx, C(BELLY))
    ctx.fill()

    # side shadow blocking on the body (left side, warm dark)
    ctx.save()
    ctx.move_to(cx - 0.16 * s, body_cy - 0.18 * s)
    ctx.curve_to(
        cx - 0.30 * s, body_cy + 0.02 * s,
        cx - 0.30 * s, body_cy + 0.30 * s,
        cx - 0.14 * s, body_cy + 0.42 * s,
    )
    ctx.curve_to(
        cx - 0.10 * s, body_cy + 0.20 * s,
        cx - 0.12 * s, body_cy - 0.02 * s,
        cx - 0.16 * s, body_cy - 0.18 * s,
    )
    ctx.close_path()
    set_src(ctx, C(WARM_DK), 0.55)
    ctx.fill()
    ctx.restore()

    # ===================== LITTLE ARMS ====================================
    # short forearms held in front, paws meeting at the chest (sentinel pose)
    for sgn in (-1, 1):
        # upper arm from shoulder, curving down & inward to the belly
        ctx.move_to(cx + sgn * 0.15 * s, body_cy - 0.16 * s)   # shoulder
        ctx.curve_to(
            cx + sgn * 0.24 * s, body_cy - 0.04 * s,
            cx + sgn * 0.21 * s, body_cy + 0.12 * s,
            cx + sgn * 0.085 * s, body_cy + 0.16 * s,          # wrist (inner)
        )
        ctx.curve_to(
            cx + sgn * 0.085 * s, body_cy + 0.08 * s,
            cx + sgn * 0.12 * s, body_cy + 0.00 * s,
            cx + sgn * 0.115 * s, body_cy - 0.14 * s,          # back to shoulder
        )
        ctx.close_path()
        set_src(ctx, C(AMBER))
        ctx.fill()
        # warm shadow along the inner arm to give it form
        ctx.move_to(cx + sgn * 0.085 * s, body_cy + 0.16 * s)
        ctx.curve_to(
            cx + sgn * 0.13 * s, body_cy + 0.06 * s,
            cx + sgn * 0.11 * s, body_cy - 0.04 * s,
            cx + sgn * 0.115 * s, body_cy - 0.14 * s,
        )
        ctx.line_to(cx + sgn * 0.085 * s, body_cy - 0.02 * s)
        ctx.close_path()
        set_src(ctx, C(WARM_DK), 0.45)
        ctx.fill()
        # paw at the chest
        fill_ellipse(ctx, cx + sgn * 0.075 * s, body_cy + 0.16 * s,
                     0.045 * s, 0.04 * s, C(AMBER_LT))

    # ===================== NECK ===========================================
    ctx.move_to(cx - 0.11 * s, head_cy + 0.18 * s)
    ctx.line_to(cx + 0.11 * s, head_cy + 0.18 * s)
    ctx.line_to(cx + 0.14 * s, body_cy - 0.18 * s)
    ctx.line_to(cx - 0.14 * s, body_cy - 0.18 * s)
    ctx.close_path()
    set_src(ctx, C(AMBER))
    ctx.fill()

    # ===================== EARS ===========================================
    for sgn in (-1, 1):
        fill_ellipse(ctx, cx + sgn * 0.20 * s, head_cy - 0.10 * s,
                     0.085 * s, 0.07 * s, C(WARM_DK))
        fill_ellipse(ctx, cx + sgn * 0.20 * s, head_cy - 0.09 * s,
                     0.045 * s, 0.04 * s, C(DEEP))

    # ===================== HEAD ===========================================
    # rounded head
    fill_ellipse(ctx, cx, head_cy, 0.235 * s, 0.225 * s, C(AMBER))

    # cheek/jaw light highlight
    fill_ellipse(ctx, cx, head_cy + 0.06 * s, 0.20 * s, 0.16 * s, C(AMBER_LT), 0.35)

    # ===================== SNOUT / MUZZLE =================================
    # lighter muzzle area pushing forward & down
    fill_ellipse(ctx, cx, head_cy + 0.10 * s, 0.135 * s, 0.115 * s, C(AMBER_LT))

    # ===================== EYE MASKS (signature meerkat dark eye patches) =
    for sgn in (-1, 1):
        ctx.save()
        ellipse(ctx, cx + sgn * 0.095 * s, head_cy - 0.01 * s, 0.085 * s, 0.095 * s)
        set_src(ctx, C(DEEP))
        ctx.fill()
        ctx.restore()
    # eye shine (only in color mode)
    if not mono:
        for sgn in (-1, 1):
            fill_ellipse(ctx, cx + sgn * 0.095 * s, head_cy - 0.015 * s,
                         0.032 * s, 0.036 * s, AMBER_LT)
            fill_ellipse(ctx, cx + sgn * 0.100 * s, head_cy - 0.040 * s,
                         0.013 * s, 0.014 * s, WHITE)

    # ===================== NOSE ===========================================
    # little rounded triangle nose
    nx, ny = cx, head_cy + 0.075 * s
    ctx.move_to(nx - 0.045 * s, ny - 0.02 * s)
    ctx.curve_to(
        nx - 0.045 * s, ny + 0.03 * s,
        nx + 0.045 * s, ny + 0.03 * s,
        nx + 0.045 * s, ny - 0.02 * s,
    )
    ctx.curve_to(
        nx + 0.02 * s, ny - 0.05 * s,
        nx - 0.02 * s, ny - 0.05 * s,
        nx - 0.045 * s, ny - 0.02 * s,
    )
    ctx.close_path()
    set_src(ctx, C(DEEP))
    ctx.fill()

    # mouth line
    if not mono:
        ctx.move_to(nx, ny + 0.025 * s)
        ctx.line_to(nx, head_cy + 0.135 * s)
        ctx.set_line_width(0.012 * s)
        set_src(ctx, WARM_DK)
        ctx.stroke()


def _meerkat_silhouette(ctx, cx, cy, s):
    """Single closed-ish path approximating the whole figure for the mono icon.
    We just stamp the major filled shapes (they union visually when filled with
    the same color). Caller sets source + fill after building? -> here we fill
    each piece directly with white to guarantee union."""
    head_cy = cy - 0.40 * s
    body_cy = cy + 0.10 * s

    set_src(ctx, WHITE, 1.0)

    # body
    ctx.move_to(cx - 0.16 * s, body_cy - 0.18 * s)
    ctx.curve_to(cx - 0.30 * s, body_cy + 0.02 * s, cx - 0.30 * s, body_cy + 0.30 * s, cx - 0.14 * s, body_cy + 0.42 * s)
    ctx.curve_to(cx - 0.04 * s, body_cy + 0.49 * s, cx + 0.04 * s, body_cy + 0.49 * s, cx + 0.14 * s, body_cy + 0.42 * s)
    ctx.curve_to(cx + 0.30 * s, body_cy + 0.30 * s, cx + 0.30 * s, body_cy + 0.02 * s, cx + 0.16 * s, body_cy - 0.18 * s)
    ctx.curve_to(cx + 0.08 * s, body_cy - 0.30 * s, cx - 0.08 * s, body_cy - 0.30 * s, cx - 0.16 * s, body_cy - 0.18 * s)
    ctx.close_path()
    ctx.fill()

    # tail
    ctx.move_to(cx + 0.10 * s, body_cy + 0.20 * s)
    ctx.curve_to(cx + 0.34 * s, body_cy + 0.30 * s, cx + 0.50 * s, body_cy + 0.18 * s, cx + 0.46 * s, body_cy - 0.05 * s)
    ctx.curve_to(cx + 0.43 * s, body_cy - 0.20 * s, cx + 0.33 * s, body_cy - 0.10 * s, cx + 0.30 * s, body_cy + 0.02 * s)
    ctx.curve_to(cx + 0.27 * s, body_cy + 0.14 * s, cx + 0.22 * s, body_cy + 0.18 * s, cx + 0.10 * s, body_cy + 0.20 * s)
    ctx.close_path()
    ctx.fill()

    # arms
    for sgn in (-1, 1):
        ctx.move_to(cx + sgn * 0.12 * s, body_cy - 0.10 * s)
        ctx.curve_to(cx + sgn * 0.20 * s, body_cy + 0.00 * s, cx + sgn * 0.16 * s, body_cy + 0.12 * s, cx + sgn * 0.06 * s, body_cy + 0.12 * s)
        ctx.curve_to(cx + sgn * 0.12 * s, body_cy + 0.04 * s, cx + sgn * 0.12 * s, body_cy - 0.02 * s, cx + sgn * 0.12 * s, body_cy - 0.10 * s)
        ctx.close_path()
        ctx.fill()

    # feet
    for sgn in (-1, 1):
        ellipse(ctx, cx + sgn * 0.12 * s, cy + 0.50 * s, 0.10 * s, 0.05 * s)
        ctx.fill()

    # neck
    ctx.move_to(cx - 0.11 * s, head_cy + 0.18 * s)
    ctx.line_to(cx + 0.11 * s, head_cy + 0.18 * s)
    ctx.line_to(cx + 0.14 * s, body_cy - 0.18 * s)
    ctx.line_to(cx - 0.14 * s, body_cy - 0.18 * s)
    ctx.close_path()
    ctx.fill()

    # ears
    for sgn in (-1, 1):
        ellipse(ctx, cx + sgn * 0.20 * s, head_cy - 0.10 * s, 0.085 * s, 0.07 * s)
        ctx.fill()

    # head
    ellipse(ctx, cx, head_cy, 0.235 * s, 0.225 * s)
    ctx.fill()


# ----------------------------------------------------------------------------
# Rendering / output plumbing
# ----------------------------------------------------------------------------
def render(size, draw_fn, opaque):
    """Render at SSx then downscale to `size`. draw_fn(ctx, big_size)."""
    big = size * SS
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, big, big)
    ctx = cairo.Context(surf)
    draw_fn(ctx, big)
    surf.flush()

    # cairo ARGB32 is premultiplied BGRA; convert to PIL RGBA
    buf = surf.get_data()
    img = Image.frombuffer("RGBA", (big, big), bytes(buf), "raw", "BGRA", 0, 1)
    # un-premultiply by splitting; PIL stored straight values already? cairo is
    # premultiplied, so divide RGB by alpha.
    img = _unpremultiply(img)
    img = img.resize((size, size), Image.LANCZOS)
    if opaque:
        img = img.convert("RGB")
    return img


def _unpremultiply(img):
    px = img.load()
    w, h = img.size
    # Vectorize via numpy if available; fallback pure python is slow at 4096.
    try:
        import numpy as np
        a = np.asarray(img).astype(np.float32)
        alpha = a[:, :, 3:4]
        rgb = a[:, :, :3]
        safe = np.where(alpha == 0, 1, alpha)
        rgb = np.clip(rgb / safe * 255.0, 0, 255)
        out = np.concatenate([rgb, alpha], axis=2).astype(np.uint8)
        return Image.fromarray(out, "RGBA")
    except ImportError:
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]
                if al:
                    px[x, y] = (min(255, r * 255 // al), min(255, g * 255 // al),
                                min(255, b * 255 // al), al)
        return img


def save(img, name):
    path = os.path.join(ASSETS, name)
    img.save(path)
    print(f"wrote {name:38s} {img.size[0]}x{img.size[1]}  mode={img.mode}")


# ----------------------------------------------------------------------------
# Compose each asset
# ----------------------------------------------------------------------------
def main():
    # 1. icon.png — full icon, bg + meerkat filling ~72% center
    def _icon(ctx, S):
        draw_background(ctx, S)
        draw_meerkat(ctx, S * 0.5, S * 0.52, S * 0.66, glow=True)
    save(render(1024, _icon, opaque=True), "icon.png")

    # 2. android-icon-foreground.png — transparent, meerkat in ~66% safe zone
    def _fg(ctx, S):
        draw_meerkat(ctx, S * 0.5, S * 0.51, S * 0.50, glow=True)
    save(render(1024, _fg, opaque=False), "android-icon-foreground.png")

    # 3. android-icon-background.png — gradient bg only
    def _bg(ctx, S):
        draw_background(ctx, S)
    save(render(1024, _bg, opaque=True), "android-icon-background.png")

    # 4. android-icon-monochrome.png — white silhouette, transparent, safe zone
    def _mono(ctx, S):
        draw_meerkat(ctx, S * 0.5, S * 0.51, S * 0.50, mono=True)
    save(render(1024, _mono, opaque=False), "android-icon-monochrome.png")

    # 5. splash-icon.png — transparent, meerkat a bit smaller margin
    def _splash(ctx, S):
        draw_meerkat(ctx, S * 0.5, S * 0.52, S * 0.60, glow=True)
    save(render(1024, _splash, opaque=False), "splash-icon.png")

    # 6. favicon.png — 48x48 downscale of full icon (with bg)
    def _fav(ctx, S):
        draw_background(ctx, S)
        draw_meerkat(ctx, S * 0.5, S * 0.52, S * 0.70, glow=True)
    save(render(48, _fav, opaque=True), "favicon.png")


if __name__ == "__main__":
    main()
