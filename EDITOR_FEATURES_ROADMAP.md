Ground truth confirmed (CE.SDK 1.76.1, 4 blur types, `hasKeyframeApi: false`). Here is the build-ready feature library.

---

# DEPT Canvas — Complete Editor Feature Library (build-ready)

Anchored to CE.SDK v1.76.1 ground truth (`scene-mcp/src/engine/capability-report.json`: `hasKeyframeApi:false`, 25 animation presets, 16 easing curves, blur types `uniform/linear/mirrored/radial`, `fillColorKey: fill/solid/color`). Tier-1 = CE.SDK preset/static engine (renders today). Tier-2 = Remotion true-keyframe (deferred, "preview only" in mock).

## Layer data model (the spine everything writes to)

```ts
type Layer = {
  id; type: 'shape'|'text'|'image'|'video'|'group';
  x; y; w; h; rotation; opacity;          // 0..1 opacity -> setOpacity (NOT 0..100)
  flipH; flipV;
  z;                                       // stacking index (see Z-ORDER)
  visible; locked;                          // lock = hard-fail at tool layer
  blendMode;                                // PascalCase 'Normal' -> setBlendMode
  fill;                                     // {kind:'color'|'gradient'|'image', ...}
  stroke;                                   // native block prop, not effect-stack
  dropShadow;                               // native block prop, not effect-stack
  blur;                                     // SINGLE native blur per block, not effect-stack
  effects: EffectStackItem[];               // ordered, bottom-to-top
  crop;                                     // {fillMode, scaleX,scaleY,transX,transY,rotation,alignH,alignV}
  maskShape?;                               // clip-to-shape silhouette (shape+fill model)
  placeholder?; contentLocked?;             // variation frames
  motion?: { presets: PresetAnim[]; delay; keyframes?: Kf[] }; // keyframes => Tier-2
}
type EffectStackItem = { type; enabled: boolean; params: Record<string,number|string> };
```
**Seam rule:** `stroke`, `dropShadow`, `blur`, `blendMode`, `opacity`, `crop` are NATIVE block properties in CE.SDK — keep them OUT of `effects[]` so the seam calls dedicated setters, not `appendEffect`. Only the 22 real effect types go in `effects[]`.

---

## 1) HIGH-PRIORITY — build first

| # | Feature | Mock technique (CSS/SVG/React) | CE.SDK mapping | Layer fields |
|---|---|---|---|---|
| 1 | **EffectStack engine** | Per-layer ordered array; compose `filter()`/SVG `<filter>` in stack order (bottom→top) | `createEffect/appendEffect/insertEffect/removeEffect/getEffects`; props via `setFloat/Int/String/Color` on `effect/<type>/<prop>`; `effect/enabled` Bool | `effects[]` ordered |
| 2 | **Adjustments (color grade)** | CSS `brightness()/contrast()/saturate()`; temp via `sepia()+hue-rotate()`; shadows/highlights via SVG `feComponentTransfer` | `//ly.img.ubq/effect/adjustments` keys `brightness,contrast,saturation,exposure,gamma,clarity,shadows,highlights,temperature,sharpness,blacks,whites` (Float, def 0) | `effects[adjustments].params` |
| 3 | **Blur (native, 1 per block)** | uniform→`filter:blur(px)`; linear→masked blurred copy along x1y1–x2y2; mirrored→tilt-shift band; radial→radial-gradient mask over blurred copy | `createBlur/setBlur/setBlurEnabled`; `blur/uniform/intensity`, `blur/linear/{blurRadius,x1,x2,y1,y2}`, `blur/radial/{blurRadius,gradientRadius,radius,x,y}`, `blur/mirrored/...` | `blur:{type,params,enabled}` |
| 4 | **Drop shadow (native)** | `filter:drop-shadow(x y blur color)` (respects alpha) | `setDropShadowEnabled/Color/OffsetX/Y/BlurRadiusX/Y`; outer-glow = offset 0/0 + big blur + brand color | `dropShadow:{enabled,color,x,y,blurX,blurY}` |
| 5 | **Glow (effect)** | `filter:drop-shadow(0 0 size color)` stacked, or SVG `feGaussianBlur+feMerge` bloom | `//ly.img.ubq/effect/glow` — `amount`(.5), `darkness`(.3), `size`(4) | `effects[glow].params` |
| 6 | **Blend modes** | CSS `mix-blend-mode` + PascalCase→CSS map; gate to layers with content beneath | `setBlendMode/getBlendMode/supportsBlendMode`; PascalCase string union | `blendMode` |
| 7 | **Opacity** | CSS `opacity`; if slider 0–100 divide by 100 | `setOpacity(0..1)/supportsOpacity` | `opacity` |
| 8 | **Shape layer (graphic+shape+fill)** | One SVG element per layer; 1:1 layer↔graphic block | `create('//ly.img.ubq/graphic')` + `createShape` + `setShape` + `createFill('color')+setFill` | `type:'shape', shapeType, fill, stroke` |
| 9 | **Stroke / border (native)** | SVG `stroke,stroke-width,stroke-linejoin,stroke-dasharray`; text via `-webkit-text-stroke` | `setStrokeEnabled/Color/Width/Style/Position/CornerGeometry`; Style: Solid/Dashed/DashedRound/Dotted/LongDashed/LongDashedRound | `stroke:{enabled,color,width,style,position,join}` |
| 10 | **Solid + gradient fill** | SVG `fill` / `<linearGradient>/<radialGradient>`; CSS hex, convert to 0..1 RGBA at seam | `fill/solid/color`; gradient fill `//ly.img.ubq/fill/gradient/linear|radial` w/ alpha stops | `fill` |
| 11 | **Crop / pan-zoom in frame** | Frame `overflow:hidden`; inner `<img>` `object-fit:cover/contain/none` + `transform: translate scale rotate`; align→`object-position` | `setContentFillMode(Crop/Cover/Contain)`, `setCropScale/Translation/Rotation`, `flipCrop*`, `setContentFill{H,V}Alignment` | `crop{...}` |
| 12 | **Clip-to-shape (frames/masks)** | `clip-path: circle()/ellipse()/polygon()/path()` over real `<img>` so crop still applies | graphic block whose **shape** = silhouette, **fill** = image (no separate mask API) | `maskShape, fill:image` |
| 13 | **Placeholder frames (variation)** | Dashed/hatch div + "Replace" when empty; Adopter mode shows only replace btn | `setPlaceholderEnabled`; role scopes `fill/change`,`text/edit`; swap URI + `resetCrop` | `placeholder, contentLocked` |
| 14 | **Z-order / layers panel** | Layers list, drag-reorder, eye/lock toggles, `z-index` | block ordering (`insertChild`/order APIs), `visible` Bool | `z, visible, locked` |
| 15 | **Text core** | family/size/weight/italic/color/letter-spacing/line-height/align/case via CSS; rich runs = styled spans | `setTextFontSize`, `toggleBold/Italic`, `setTextColor`, `text/letterSpacing`,`text/lineHeight`,`text/horizontalAlignment`, `setTextCase`; character-range styling | `type:'text', runs[]` |
| 16 | **Text stroke + drop shadow** | `-webkit-text-stroke`; `text-shadow` | text-block `setStroke*` / `setDropShadow*` (`supportsStroke/DropShadow` gate) | reuse `stroke`,`dropShadow` |
| 17 | **Animation presets (in/out/loop)** | CSS keyframes lib keyed to preset name + 16 easing beziers; text presets via per-glyph stagger | 25 presets (slide,pan,fade,blur,grow,zoom,pop,wipe,spin,ken_burns,…; text: typewriter/spread/merge/block_swipe) + `playback/duration` | `motion.presets[]` (Tier-1) |
| 18 | **Easing enum (16)** | Map each to CSS `cubic-bezier`; Back/Spring→overshoot beziers | `animationEasing` enum (Linear, Ease*, Quart, Quint, Back, Spring) via `setEnum` | `preset.easing` |
| 19 | **Group / ungroup** | Group node in tree; transform propagates | Group block + children | `type:'group', children[]` |
| 20 | **Align / distribute + snapping/guides** | App-side: bbox math, snap nearest edge/center, render guides + grid | engine exposes position/size only; computed app-side | uses `x,y,w,h` |
| 21 | **Rotation & flip** | CSS `rotate` + `scaleX/Y(-1)` | `rotation` prop + flip | `rotation, flipH, flipV` |
| 22 | **Shape library (Canva rail)** | Each rail item = `{label, lower:CesdkShape, params}`; primitives→native SVG, others→`<path>` from name→path map | lowers to 6 primitives + `vector_path` (see §SHAPE LIBRARY) | `shapeType, shapeProps` |
| 23 | **Image / video export** | Mock: SVG-serialize/html2canvas preview + progress dialog | `block.export` PNG/JPG/PDF; video MP4/WebM/MOV SD–4K | — |
| 24 | **Generate-once / render-many** | Variation grid: master + override matrix (size/copy/locale); reuse assets across sizes | scene re-layout + size sets, orchestration-driven | master + overrides |
| 25 | **Locks (frozen brand props)** | Lock badges; disable handles/inputs; rejection toast | NOT CE.SDK — enforced in MCP tool layer, writes hard-fail + audited | `locked`, per-prop locks |
| 26 | **AI background removal** | Button → plugin; before/after w/ checkerboard alpha | `@imgly/plugin-background-removal-web` (on-device WASM/WebGPU) — Tier-1 | action, swaps fill |
| 27 | **Pages / scenes / artboards** | Page thumbnail rail; scene-graph state; per-page sizes | Scene + page blocks; design/video modes | page tree |

---

## 2) MEDIUM backlog (brief)

- **LUT filter** — curated preset grid (hosted LUT PNGs); mock = tuned CSS chain + intensity opacity blend. `//ly.img.ubq/effect/lut_filter` (`lutFileURI`,`intensity`,`h/vTileCount`).
- **Duotone** — SVG `feColorMatrix`→grayscale + `feComponentTransfer` 2-color. `effect/duotone_filter` (`darkColor`,`lightColor`,`intensity`).
- **Vignette** — radial-gradient overlay div. `effect/vignette` (`darkness`,`offset`).
- **Recolor** (brand recolor axis) — `mix-blend-mode:color` overlay or canvas per-pixel. `effect/recolor` (`fromColor`,`toColor`,`colorMatch`,`brightnessMatch`,`smoothness`).
- **Black & White preset** — one-click `adjustments.saturation=-1` (CSS `grayscale(1)`). NOT a separate effect type.
- **Text background/highlight** — CSS `background+padding+border-radius`. native `backgroundColor`+padding+radius props.
- **Gradient text** — `background-clip:text`. Not first-class on text in CE.SDK (graphic-mask workaround).
- **Curved text / text-on-path** — SVG `<textPath>`. NOT native CE.SDK.
- **Auto-fit / max-lines** — JS measure loop + `line-clamp`. native text auto-size + clip.
- **Text animation granularity** — split spans, staggered delays. `textAnimationWritingStyle`(Block/Line/Word/Character)+`textAnimationOverlap`.
- **Gradient/fade mask** — route 1 overlay scrim (`linear-gradient` div = gradient-fill overlay block, honest); route 2 `mask-image` on img flagged "mock-approx" (no true alpha-mask channel in CE.SDK).
- **Container clip** — `overflow:hidden` on group; toggle → `setClipped`. Rect bounds only.
- **Image/video/pattern fill** — `background-image/repeat`; `<video>` fill. `createFill image/video`.
- **Stagger/sequencing** — per-layer `delay`; offset frame-time. Tier-1 composed; Tier-2 `<Sequence>`.
- **Anticipation/overshoot** — overshoot bezier `cubic-bezier(.34,1.56,.64,1)` or JS spring. Tier-1 Back/Spring enum only; full = Remotion `spring()`.
- **Blur reveal/defocus** — CSS `filter:blur()` keyframe. native `animation/blur`,`animation/blur_loop`.
- **Static linear/radial blur effect** — SVG directional/zoom blur. native blur types (linear=directional, radial=zoom).
- **Scene/page transitions** — CSS transition overlay between page swaps. partial (per-element presets; page system app-orchestrated).
- **Chroma key/green screen** — canvas chroma-key preview or controls + "rendered at export". `effect/green_screen`.
- **Timeline (video)** — draggable clips/trim handles → timeOffset/duration. native video mode.
- **Video clips / audio tracks** — `<video>`/waveform + trim/speed/volume. native video/audio blocks.

## 3) LOW backlog (brief)

Pixelize, Half Tone, Dot Pattern, Posterize, Tilt Shift, Extrude Blur, Cross Cut*, TV Glitch*, Liquid*, Outliner, Linocut, Radial Pixel, Mirror, Shifter, Sharpie (toggle-only) — all real `//ly.img.ubq/effect/*` types; SVG-filter/canvas approximations; `*`=animated → Tier-2 favored. Plus: Sharpen (`feConvolveMatrix`), Vectorize (plugin), Boolean shape combine (`combine([],op)` → defer to paper.js precompute), Lines/connectors/arrows (SVG `marker-end`; auto-routing NOT native), Bulleted/numbered lists (HTML render, NOT native), Parallax (depth slider; Tier-1 ken_burns approx).

---

## 4) MOTION BLUR — resolved

**Mock formula (drive from the interpolation we already compute):**
```
// per frame, in px-space
vx = (x[t] - x[t-1]) * fps;  vy = (y[t] - y[t-1]) * fps;
speed = Math.hypot(vx, vy);
angle = Math.atan2(vy, vx);                  // heading
blurPx = Math.min(speed * k, MAX_PX);        // k ~ 0.5–1, MAX_PX ~ 40
// render: wrapper rotated to `angle`, child gets filter: blur(blurPx),
// then counter-rotate content — gives a directional smear along motion vector.
```
Best faithful mock look = **Remotion `<Trail>` reproduced now in React**: render `layers` (8–16) absolutely-positioned duplicates at transform for time `(frame - i*lagInFrames)`, `opacity = trailOpacity*(1 - i/layers)`. Cheap full-scene shutter blur = stack 3–6 offset copies at `1/N` opacity (frame-average, mimics `<CameraMotionBlur shutterAngle=180 samples=10>`).

**Real render:**
- CE.SDK (Tier-1): **NOT supported** — no velocity coupling, no sub-frame sampling. Only `animation/blur` focus-reveal (blurred→clear) and `animation/blur_loop` exist, plus static `blur/linear` (directional) / `blur/radial` (zoom) effects. Use those for *faux* streaks, badge as "static".
- Remotion (Tier-2): real — `<CameraMotionBlur>` (shutter), `<Trail>` (echo), velocity blur via per-frame sampling. **Tag motion-blur intent as Tier-2-only; preview badge in mock.**

## 4b) BLEND MODES — full list + CSS map

PascalCase (CE.SDK `setBlendMode`) → CSS `mix-blend-mode`. Default **Normal→normal**.

| CE.SDK | CSS | CE.SDK | CSS |
|---|---|---|---|
| Normal | normal | Overlay | overlay |
| Darken | darken | SoftLight | soft-light |
| Multiply | multiply | HardLight | hard-light |
| ColorBurn | color-burn | Difference | difference |
| Lighten | lighten | Exclusion | exclusion |
| Screen | screen | Hue | hue |
| ColorDodge | color-dodge | Saturation | saturation |
| | | Color | color |
| | | Luminosity | luminosity |

**Extended CE.SDK modes with NO CSS equivalent — approximate + "exact only in render tiers" badge:** LinearBurn~multiply (or `plus-darker`), DarkenColor~darken, LinearDodge(Add)~`plus-lighter` (true additive) else screen, LightenColor~lighten, VividLight~overlay, LinearLight~hard-light, PinLight~hard-light, HardMix~hard-light, Subtract~difference, Divide~screen/skip. **PassThrough** (groups only) = simply do NOT set `isolation:isolate` on the group wrapper. **Gate** the picker to layers with content beneath; each page = own stacking context so blends never leak across pages.

## 4c) EFFECTS to add NOW (with types)

| UI control | Where in model | CE.SDK |
|---|---|---|
| **Brightness/Contrast/Saturation** (+ exposure, temp, shadows, highlights…) | `effects[adjustments]` (effect stack) | `//ly.img.ubq/effect/adjustments` (12 Float keys, def 0) |
| **Glow** | `effects[glow]` (effect stack) | `//ly.img.ubq/effect/glow` (amount/darkness/size) |
| **Drop shadow** | `dropShadow` (NATIVE, not stack) | `setDropShadow*` setters |
| **Blur** | `blur` (NATIVE, 1 per block, not stack) | `createBlur/setBlur` — uniform/linear/mirrored/radial |

Brightness/contrast/saturation live in the effect stack (adjustments); shadow and blur are native block props with dedicated setters — keep them separate in state so the seam is honest.

## 4d) SHAPE LIBRARY (lowers to 6 primitives + vector_path)

**Native primitives** (`createShape`, short forms accepted): `rect, line, ellipse, polygon, star, vector_path`. No triangle/heart/arrow primitive — those are `polygon` or `vector_path`.

| Rail item | Lowers to | SVG render | Key props |
|---|---|---|---|
| Rectangle / Rounded / Square | `rect` | `<rect rx ry>`; per-corner→`<path>` 4 arcs | `cornerRadiusTL/TR/BL/BR` (Float, def 0) |
| Circle / Ellipse | `ellipse` | `<ellipse cx=w/2 cy=h/2 rx=w/2 ry=h/2>` | none (sized by frame); circle = 1:1 lock |
| Line / Divider | `line` | `<line>` + stroke-width, or thin `<rect>` | none; appearance via stroke |
| Triangle/Pentagon/Hexagon/Diamond | `polygon` | computed `<polygon points>` (n verts on inscribed ellipse, start −90°) | `sides`(3/5/6/4-rot45), `cornerRadius` |
| Star / Burst / Sparkle | `star` | alternating outer/inner-radius `<polygon>` | `points`(Int,5), `innerDiameter`(0..1,.5) — **no star cornerRadius in 1.76** |
| Arrow/Chevron/Heart/Speech/Thought/Cloud/Blob/Check/Plus/Badge/Shield/Frame/Callout | `vector_path` | `<path d=… fill-rule>` in `viewBox 0 0 w h`, scaled to frame | `path`(SVG d), `width`, `height`, `fillRule`(EvenOdd/NonZero) — single path + single color to stay recolorable |

Each entry = one record `{label, lower, params}`; adding a shape = adding a record, seam already knows how to lower it.

## 4e) MASKS — resolved (3 real routes + 1 Tier-2-only)

1. **Clip-to-shape (silhouette)** — HIGH, real. `clip-path: circle()/ellipse()/polygon()/path()` over a real `<img>`; CE.SDK = graphic block where shape=silhouette, fill=image. Mask-shape picker (circle, rounded-rect, star, polygon-N, heart, blob) on image layers.
2. **Container clip (rect bounds)** — MEDIUM, real. `overflow:hidden` on group → `setClipped(parent,true)`. Rectangular only.
3. **Gradient/fade mask** — MEDIUM. Honest route = overlay scrim div (`linear-gradient` = gradient-fill overlay block). `mask-image` on the img itself is "mock-approx" only (CE.SDK has no per-pixel alpha-mask channel) — store as gradient overlay block to keep the seam honest.
4. **True alpha mask / track matte / feathered free-form / layer-as-mask** — **NOT in CE.SDK** (no mask-block, no track matte; `cutout` = print cut-lines, `exportWithColorMask` = export util). **Tier-2 Remotion only** — SVG `<mask>`/`mix-blend-mode`/per-frame mask animation. Never silently map to a CE.SDK feature; badge Tier-2.

## 4f) Z-ORDER / layer reordering

Layers panel = ordered list mirroring the scene tree; **drag-reorder writes `layer.z`**, render via `z-index`. Per-row eye (`visible` Bool → `setVisible`) and lock (`locked`). Reordering maps to CE.SDK block ordering (`insertChild`/order APIs) at the seam — append-to-top vs insert-at-index mirror `appendEffect`/`insertEffect` semantics. Group children reorder within the group's own context; **each page is its own stacking context** so z-order and blends never leak across pages. Locked layers reject reorder at the tool layer (hard-fail + audit), consistent with the locks model.

**Build order suggestion:** EffectStack engine (#1) + native-props (blur/shadow/stroke/blend/opacity) + shape model (#8/#22) + crop/clip (#11/#12) form the foundation; then text core, animation presets, layers/z-order/group/align, then placeholder+variation. Adjustments/glow/blend/shadow/blur are the four "effects now."
