"""Square image cards for Instagram, Facebook and Telegram (Instagram only accepts posts with media)."""

from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont

SIZE = 1080
MARGIN = 96


def _hex(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    if len(color) != 6:
        return (109, 40, 217)
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: object, width: int, max_lines: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font) <= width:
            line = candidate
            continue
        if line:
            lines.append(line)
        line = word
        if len(lines) == max_lines:
            break
    if line and len(lines) < max_lines:
        lines.append(line)
    if len(lines) == max_lines and " ".join(lines) != " ".join(words):
        last = lines[-1]
        while last and draw.textlength(last + "...", font=font) > width:
            last = last[:-1]
        lines[-1] = last.rstrip() + "..."
    return lines


def render_card(*, eyebrow: str, body: str, footer: str, primary: str, accent: str) -> bytes:
    """A 1080x1080 JPEG: brand-coloured background, a small label, the text and a footer."""
    top, bottom = _hex(primary), _hex(accent)
    image = Image.new("RGB", (SIZE, SIZE), top)
    gradient = ImageDraw.Draw(image)
    for y in range(SIZE):
        t = y / SIZE * 0.55  # Mostly the primary colour, warming towards the accent at the bottom.
        gradient.line(
            [(0, y), (SIZE, y)],
            fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    draw = ImageDraw.Draw(image)
    draw.text((MARGIN, MARGIN), eyebrow.upper(), font=_font(38), fill=(255, 255, 255))
    size = 64 if len(body) < 140 else 52 if len(body) < 320 else 44
    font = _font(size)
    lines = _wrap(draw, body.replace("\n", " "), font, SIZE - 2 * MARGIN, max_lines=12 if size == 44 else 10)
    y = MARGIN + 110
    for line in lines:
        draw.text((MARGIN, y), line, font=font, fill=(255, 255, 255))
        y += int(size * 1.3)
    draw.text((MARGIN, SIZE - MARGIN - 40), footer, font=_font(36), fill=(255, 255, 255))
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=88)
    return out.getvalue()
