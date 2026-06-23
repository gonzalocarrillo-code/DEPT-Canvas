# DEPT Canvas — Cost Audit (per render · per user)

Estimated unit economics across the whole stack: GCP compute (Cloud Run / Jobs / GPU),
OpenAI API, CE.SDK + Fluendo codec licensing, GCS/Cloud SQL/networking. All prices are
**2026 list/on-demand, USD, us-central1 / US multi-region**, no committed-use discounts.
Researched from official vendor pricing (workflow `wfu75iute`; synthesis hand-finished
after the agent stalled). **CE.SDK is contact-sales — those figures are a planning band,
not a quote.**

## 1. Summary — every cost source

| Source | Unit | Price | Where it lands |
|---|---|---|---|
| Cloud Run vCPU (request-billed) | vCPU-sec | $0.000024 | scene-MCP service |
| Cloud Run memory | GiB-sec | $0.0000025 | scene-MCP service |
| Cloud Run requests | 1M req | $0.40 (2M free) | scene-MCP service |
| Cloud Run **L4 GPU** | GPU-sec | ~$0.000187 (~$0.67/hr) | renderer (MP4) |
| GKE Autopilot vCPU / mem | vCPU-hr / GiB-hr | ~$0.0445 / ~$0.0049 | renderer at scale |
| Compute Engine L4 / T4 GPU | GPU-hr | ~$0.594 / ~$0.35 | GKE render nodes |
| **OpenAI gpt-image-1** 1024² | image | $0.011 low · $0.042 med · **$0.167 high** | master / asset gen |
| OpenAI gpt-image-2 1024² | image | $0.03 | newer image model (real) |
| OpenAI gpt-4o-mini | 1M tok | $0.15 in / $0.60 out | copy, transcreation, plan |
| OpenAI gpt-5.4-mini | 1M tok | $0.75 in / $4.50 out | harder planning (real) |
| OpenAI omni-moderation | — | **free** | safety pipeline |
| GCS Standard storage | GB-mo | $0.026 multi / $0.020 single | scenes + MP4 variants |
| GCS egress to internet | GB | $0.12 (first TB) | **delivering variants** |
| Cloud SQL (small, non-HA) | instance-mo | ~$57 | per-tenant DB |
| Cloud Load Balancer | mo | ~$18.25 (+$0.008/GiB) | edge |
| Secret Manager | active version-mo | $0.06 (6 free) | per-tenant secrets |
| Cloud Logging / Monitoring | GiB / MiB | $0.50 / $0.258 (free tiers) | observability |
| **CE.SDK enterprise license** | year | **contact sales (~$30k–120k+ band)** | fixed, amortized/seat |
| **Fluendo H.264/H.265 codec** | year | **contact sales** | renderer container |

## 2. Cost per render (one variation MP4 — generate-once / render-many)

Variable content is generated **once** per master; each size/locale only *renders* from it.

| Component | Math | $ |
|---|---|---|
| Render compute (Cloud Run Job, 1×L4 + 4 vCPU + 16 GiB, ~30–60s wall) | GPU 60s·$0.000187 + 4·60·$0.000018 + 16·60·$0.000002 | **$0.009–0.0175** |
| GCS storage (≈30 MB variant · 1 mo) | 0.03 × $0.026 | $0.0008 |
| Egress (deliver ≈30 MB once) | 0.03 × $0.12 | $0.0036 |
| Amortized OpenAI gen ($0.17 ÷ 100 variants) | — | $0.0017 |
| CE.SDK + codec (annual fixed) | amortized | ~$0.000 |
| **Per rendered variation** | | **≈ $0.015–0.025** |

→ **~2¢ per rendered variation**, compute-dominated. Use **T4** (~$0.35/GPU-hr) instead of L4 and it drops further; archive variants to Nearline to cut storage.

## 3. Cost per master + fan-out (N = 100 variations)

| Component | Math | $ |
|---|---|---|
| OpenAI generation (1 master image *high* + 5 copy + 3 transcreations + 1 brief plan) | worked example | $0.17 |
| 100 renders | 100 × $0.0175 | $1.75 |
| Storage (≈3 GB · 1 mo) | 3 × $0.026 | $0.08 |
| Egress (one full delivery of all variants, 3 GB) | 3 × $0.12 | $0.36 |
| **Per 100-variant master (variable)** | | **≈ $2.36** |

A master fanned to 100 on-brand sizes/locales costs **~$2.40 in variable spend** — the platform's core economic claim (author once, render many, cheaply).

## 4. Cost per user / month

Assume an active creator: **20 masters/mo × 50 variations = 1,000 renders**.

| Component | Math | $/user/mo |
|---|---|---|
| OpenAI generation | 20 × $0.17 | $3.40 |
| Render compute | 1,000 × $0.0175 | $17.50 |
| Storage | ~30 GB · $0.026 | $0.78 |
| Egress (one delivery each) | ~30 GB · $0.12 | $3.60 |
| **Variable subtotal** | | **≈ $25/user/mo** |
| Tenant infra baseline (Cloud SQL ~$57 + LB ~$18 + secrets/obs ~$10 ≈ $85/mo) ÷ seats | $85 ÷ 25 | ~$3.40 |
| **CE.SDK license** ($60k/yr planning midpoint) ÷ seats | $5,000/mo ÷ 25 | **~$200** |
| **All-in @ 25 seats/tenant** | | **≈ $230/user/mo** |
| **All-in @ 200 seats** ($120k/yr ÷ 200 = $50) | | **≈ $80/user/mo** |

**The model is dominated by the CE.SDK enterprise license**, which amortizes sharply with seat count. Variable AI+compute is small (~$25/user/mo). Everything else (DB, egress, storage) is rounding error at this scale.

## 5. Key takeaways / levers
- **Variable cost is tiny** — ~$0.02/render, ~$2.40/100-variant master, ~$25/active creator/mo. The generate-once/render-many architecture is the reason.
- **The CE.SDK license is the swing factor** (contact-sales, ~$30k–120k+/yr). Negotiate on platforms (Node.js + Web), the `-avlicensed` renderer, and seat tiers. Get a real quote — the Tier-2 Remotion path is also relevant here since Remotion is open-source (only its render compute costs, no per-engine license).
- **Cut compute**: T4 over L4, scale-to-zero Cloud Run Jobs (min-instances=0), batch renders.
- **Cut egress** (the second-largest variable): serve via CDN with caching, archive cold variants to Nearline/Coldline.
- **OpenAI**: use gpt-image *medium* ($0.042) for drafts and reserve *high* ($0.167) for masters; gpt-4o-mini for copy, gpt-5.4-mini only for hard planning; moderation is free.

## Assumptions
us-central1 / US multi-region, list prices, no CUD/SUD. 30 MB/variant, 3 GB/100-variant master. CE.SDK/Fluendo are sales-led with no public price list — bands are from Vendr transaction data (~$13.3k avg, small/single-platform deals), competitor-comparison blogs, and patent-pool reporting, scaled up for a multi-platform + avlicensed-renderer enterprise contract. **Confirm CE.SDK with IMG.LY sales before committing.**
