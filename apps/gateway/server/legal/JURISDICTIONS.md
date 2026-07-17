---
title: Jurisdiction compliance profiles
---

**Template — not legal advice.** This is an index, not a complete
compliance program. Each profile below tells you which parts of this
toolkit are relevant and which registrations/feeds to look at — it does
not replace legal review for the jurisdiction(s) where you actually
operate or have users.

# Jurisdiction compliance profiles

A "profile" here is a short answer to: *if you operate in or serve
users in this jurisdiction, which docs in this toolkit apply, which
feeds should you subscribe to, and what registrations/duties come up
repeatedly?* Profiles are deliberately short. They point you to the
detailed guide (`DMCA.md`, `DSA.md`, etc.) and to official sources —
they do not restate the law.

Operators and contributors: add a profile for your jurisdiction by
copying the structure below. Keep entries factual and sourced; if a
claim needs a citation you're not sure of, link to the official source
instead of guessing. Send profile additions/corrections the same way
you'd contribute to any other part of this reference implementation —
this file is meant to grow via community contribution, not to ship
"finished."

---

## United States

- **Applicable docs:** `DMCA.md` (copyright, 17 U.S.C. §512),
  `CSAM.md` (mandatory NCMEC reporting), `AUP.md`, `TERMS.md`.
- **Feeds to consider:** any `feed.takedown`
  ([spec/003-kinds-registry.md](../../../../spec/003-kinds-registry.md)
  §6.7) published by US-focused compliance organizations or industry
  hash-sharing programs relevant to your content categories.
- **Registration/agent duties:**
  - DMCA designated agent registered at dmca.copyright.gov
    (`DMCA.md` §1).
  - CSAM: mandatory reporting to NCMEC on any confirmed match
    (`CSAM.md`).
  - Repeat-infringer policy adopted, published, and enforced
    (`DMCA.md` §5).
- **Notes:** state-level laws (e.g., state privacy statutes, state
  age-verification/minors laws) can layer on top of federal law
  depending on where your users are. Not covered here — this profile
  is federal-baseline only.

## European Union

- **Applicable docs:** `DSA.md` (Regulation (EU) 2022/2065),
  `CSAM.md`, `AUP.md`, `TERMS.md`, `GEO-BLOCKING.md` (useful where a
  national court order is properly scoped to one member state).
- **Feeds to consider:** `feed.takedown` feeds published by EU/national
  hotlines or authorities relevant to your content categories; consider
  whether you need to submit statements of reasons to the EU DSA
  Transparency Database (`DSA.md` §"Statement of reasons").
- **Registration/agent duties:**
  - No single EU-wide "designated agent" registry equivalent to the US
    DMCA directory — but you need a functioning notice-and-action
    channel (`DSA.md` §"Notice-and-action") and, depending on size, a
    legal representative in the EU if you're not established there
    (check current DSA Article 13 requirements directly).
  - CSAM: mandatory reporting per your jurisdiction's equivalent body
    (`CSAM.md` §"Reporting" — link out per country; there is no single
    EU-wide body equivalent to NCMEC).
- **Notes:** obligations scale with size (Very Large Online Platform
  thresholds carry extra duties this toolkit does not cover — see
  `DSA.md` §"What this file does not cover"). Individual member states
  may also have national implementing rules and additional national law
  (e.g., NetzDG-style rules in Germany) layered on top of the DSA;
  check the specific member states where you have meaningful user
  bases.

## Adding a profile

Suggested structure for a new jurisdiction:

```markdown
## <Country / region>

- **Applicable docs:** <which files in this folder apply>
- **Feeds to consider:** <feed.takedown publishers relevant here, if any>
- **Registration/agent duties:** <agent registries, reporting bodies, filing duties>
- **Notes:** <caveats, size thresholds, sub-national variation, sources>
```

Keep it short, cite official sources for anything specific (statute
numbers, registry URLs, agency names), and say plainly where you're
unsure — a profile that points an operator to the right official source
is more useful than one that guesses at details.
