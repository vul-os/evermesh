---
title: EU Digital Services Act — quick orientation
---

**Template — not legal advice.** This is a short practitioner-orientation
to the EU Digital Services Act (Regulation (EU) 2022/2065, "DSA") for
gateway operators, focused on the notice-and-action mechanics that map
onto the same record kinds as the US DMCA guide. It is not a full DSA
compliance manual — the DSA is long, has size-tiered obligations, and is
actively being interpreted by regulators and courts. Verify current text
and guidance at **eur-lex.europa.eu** and the European Commission's DSA
pages before relying on anything here. Fill in `{{PLACEHOLDER}}` tokens.

# DSA orientation for {{GATEWAY_NAME}}

## When does the DSA apply to you?

The DSA applies to providers of "intermediary services" — which
includes hosting services, and a gateway that stores and serves user
content at their request is a hosting service — offered to recipients
located in the EU, **regardless of where the provider itself is
established**. If {{GATEWAY_NAME}} has EU users, EU rules can apply to
you even if {{OPERATOR_ENTITY}} is not an EU entity. Some obligations
scale with size (e.g., the heaviest systemic-risk obligations apply only
to services designated as Very Large Online Platforms, a threshold
measured in EU monthly active users under Article 33) — most gateways
will not hit that threshold, but the baseline notice-and-action duties
below are not size-gated in the same way. Confirm your specific
obligations and any small/micro-enterprise exemptions with counsel;
thresholds and designations are maintained by the European Commission
and can change.

## Notice-and-action (Article 16)

Article 16 requires hosting services to put mechanisms in place that
let any individual or entity notify them of specific content the
notifier considers illegal, and the notice must let the provider
identify the illegality without a detailed legal examination. This maps
directly onto the intake you're already building for DMCA:

| DSA Article 16 element | `notice.takedown` field |
|---|---|
| Explanation of why the content is considered illegal | `statement` |
| Location of the content (URL / identifier) | `refs` — `[0, <manifest id>]` / `[1, <blob id>]` |
| Name and email of the notifying party | `claimant.name`, `claimant.contact` |
| Statement of good-faith belief in the notice's accuracy | part of `statement` |

Set `regime` to `eu-dsa-16`. Unlike the DMCA path, Article 16 covers
**illegal content generally**, not only copyright — defamation, illegal
hate speech, product-safety violations, counterfeit goods, and more, as
defined by the law that makes the content illegal (which is usually
national or other EU law, not the DSA itself — the DSA sets the
*process*, not what's illegal).

## Statement of reasons (Article 17)

When you restrict content — removal, de-indexing, demotion, monetization
restriction, or account suspension — because you believe it is illegal
or violates your terms, Article 17 requires you to give the affected
user a **statement of reasons** before or at the time of the
restriction (limited exceptions for repeat/manifestly illegal cases and
legal/law-enforcement constraints). The statement must include, among
other things: the facts and circumstances relied on, whether automated
means were used, the legal ground or contractual clause relied on, and
information about redress (internal complaint-handling and, where
applicable, out-of-court dispute settlement or judicial redress).

Practically: when {{GATEWAY_NAME}} acts on a `notice.takedown` or its
own policy, generate a statement of reasons alongside the action and
deliver it to the affected user — this is a natural companion artifact
to the takedown record, not a separate ad hoc process. The European
Commission also operates a public DSA Transparency Database that
platforms submit statements of reasons to; check current requirements
for whether and how {{GATEWAY_NAME}} needs to submit there.

## Internal complaint-handling and redress (Articles 20–21)

Users affected by a restriction are generally entitled to access an
internal complaint-handling system and, if unresolved, an out-of-court
dispute settlement body. A `claim.dispute` record
([spec/005-claims.md](../../../../spec/005-claims.md) §4) referencing
the `notice.takedown` is a natural fit for the internal-complaint step —
it's already how the protocol represents "this notice/claim is
contested." How you route users to a certified out-of-court body (where
your size/obligations require one) is an operational process this
toolkit does not automate; confirm whether that obligation applies to
you.

## Transparency reporting (Article 15, Article 24)

Hosting-service providers generally must publish periodic transparency
reports on content moderation actions (numbers of notices received,
median time to action, own-initiative moderation, etc.). Exact frequency
and content requirements depend on your size and role (ordinary hosting
provider vs. online platform vs. VLOP) — check Articles 15 and 24 and
current Commission guidance for what applies to {{GATEWAY_NAME}}. If
you already log every selection/moderation action locally per
[spec/009-gateway.md](../../../../spec/009-gateway.md) §1 ("gateways
SHOULD log every selection action locally for its own audit"), you
already have most of the raw data a transparency report needs — this is
a reporting-format problem, not a data-collection problem, if you've
been logging from day one.

## Terms and conditions transparency (Article 14)

Your terms (`TERMS.md`) must be clear, accessible, and in plain
language, and must describe your content-moderation policies, tools,
and procedures, including any use of automated means. This is a
reasonable bar for the honesty style this whole toolkit already aims
for — say what you actually do, not what sounds impressive.

## What this file does not cover

This is an orientation, not a compliance program. It does not cover:
VLOP-specific systemic-risk assessments and audits (Articles 34–37, 42),
trusted-flagger status (Article 22), advertising transparency (Article
26), recommender-system transparency (Article 27), or minor-protection
obligations (Article 28) in any depth. If {{GATEWAY_NAME}} grows into
those thresholds, get dedicated DSA counsel — the obligations there are
substantial and specific.

## Official sources to check directly

- Regulation (EU) 2022/2065 (full text) — eur-lex.europa.eu
- European Commission, Digital Services Act pages and DSA Transparency
  Database — digital-strategy.ec.europa.eu
