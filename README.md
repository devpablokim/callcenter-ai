# CallCenter AI — interactive landing page

Cinematic, scroll-driven "About" page for the CallCenter AI service.
Stack: Vite · three.js (WebGL hero) · GSAP ScrollTrigger · Lenis smooth scroll.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
```

## Image assets (imagegen skill)

Images are generated with the `imagegen` skill (`.claude/skills/imagegen`, from
[openai/skills](https://github.com/openai/skills), Apache-2.0) in its CLI mode,
using `gpt-image-2.5-sunburst`.

**Where the API key goes** (never commit it — `.env` is gitignored):
- **Claude Code cloud:** add `OPENAI_API_KEY` in the environment settings
  (cloud environment menu → Edit → API credentials / environment variables).
- **Local machine:** copy `.env.example` to `.env` and uncomment `OPENAI_API_KEY=sk-...`.

Then:

```bash
pip install openai
npm run genimage              # writes public/assets/gen/*.webp
npm run genimage -- --force   # regenerate existing files
npm run genimage -- --dry-run # preview payloads, no API call
```

Prompts live in `scripts/imagegen/prompts.jsonl`. Until images exist, every image
slot falls back to a dark gradient, so the page works without them.

## Sections
Preloader → pinned WebGL hero (particle voice orb, 360vh scroll) → word-by-word
statement → swipeable agent cards → velocity-reactive client marquee → metrics
accordion with counters → capabilities with scroll-rotated 3D cubes → CTA with
cursor-following button → footer with "continue to scroll" loop.
