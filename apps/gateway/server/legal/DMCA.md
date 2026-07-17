---
title: DMCA (17 U.S.C. §512) operator guide
---

**Template — not legal advice.** This is a practitioner-orientation
guide to US copyright safe-harbor mechanics, written so you can wire up
the notice-intake endpoints and know what you're looking at. It is not
a substitute for counsel, and copyright law changes — verify current
requirements at the official sources linked below before you rely on
this. Fill in `{{PLACEHOLDER}}` tokens.

# DMCA §512 safe harbor for {{GATEWAY_NAME}}

If {{GATEWAY_NAME}} stores content at the direction of users (it does —
that's what a gateway is) and you want the safe harbor from monetary
liability for user infringement under 17 U.S.C. §512(c), you generally
need to do four things: designate an agent, respond properly to
notices, maintain a repeat-infringer policy, and not have actual or
"red flag" knowledge of specific infringement you fail to act on. None
of this is optional if you want the safe harbor — skipping steps
doesn't just weaken your case, it can forfeit the defense entirely.

## 1. Designate an agent

Register a DMCA designated agent with the US Copyright Office at
**dmca.copyright.gov** (the official Designated Agent Directory). This
registration is a statutory prerequisite for the §512(c) safe harbor —
an unregistered agent generally means no safe harbor, regardless of how
good your internal process is. Check the Copyright Office site directly
for current fees, renewal cadence (registrations must be kept current;
the Office has required periodic renewal in the past), and the exact
registration form — these details change and this document does not
attempt to restate them.

Your registered agent contact should match what you publish in
`TERMS.md` (`{{DMCA_AGENT}}`) and on a public "Copyright / DMCA" page on
{{GATEWAY_NAME}}.

## 2. Receiving a takedown notice

A compliant notice under §512(c)(3)(A) has six elements. Here's how
they map onto the `notice.takedown` record
([spec/003-kinds-registry.md](../../../../spec/003-kinds-registry.md)
§6.5) your intake endpoint produces:

| Statutory element (§512(c)(3)(A)) | `notice.takedown` field |
|---|---|
| (i) Signature of a person authorized to act for the rights owner | `signature_name` |
| (ii) Identification of the copyrighted work claimed infringed | `work` |
| (iii) Identification of the infringing material, sufficient to locate it | `refs` — one or more `[0, <manifest id>]` / `[1, <blob id>]` pairs |
| (iv) Contact information for the complaining party | `claimant.contact` (and `claimant.name`, `claimant.on_behalf_of` if the claimant is an agent) |
| (v) Good-faith-belief statement | part of `statement` |
| (vi) Accuracy statement made under penalty of perjury, plus authority to act | part of `statement` |

**Important gap to design around:** the kind schema has a single free-text
`statement` field, but the statute requires *two distinct statements*
((v) and (vi) above). Your intake form must collect both and concatenate
them into `statement` — do not let a submitter satisfy only the
good-faith-belief clause and skip the penalty-of-perjury accuracy
clause, or the notice is statutorily deficient even though it will
still parse as a valid record.

Set `regime` to `us-dmca-512`. A notice that's missing a required field
is not just legally weak — it fails the kind's own validation
(§6.5: "at least one ref; all required fields non-empty") and won't be
treated as a valid record at all.

## 3. Takedown workflow

1. Notice arrives (web form, email, or API) → validate the six elements
   above are all present, at minimum in substance.
2. Emit a signed `notice.takedown` record referencing the subject
   manifest/blob(s).
3. Remove or disable access to the material **expeditiously** — the
   statute doesn't define an exact clock, but courts and practice treat
   "expeditious" as fast, measured in a small number of business days
   at most for clear-cut cases. De-index and stop serving on
   {{GATEWAY_NAME}}; this does not and cannot remove the record or blob
   from the substrate ([spec/009-gateway.md](../../../../spec/009-gateway.md)
   §1) — say so if you notify the uploader.
4. Notify the uploader that their content was removed and why, and that
   they may send a counter-notice (§4 below), unless you have a
   specific reason not to (e.g., you reasonably suspect the takedown
   concerns an ongoing law-enforcement matter).
5. Log the notice, the record id it produced, and the action taken —
   this is your evidence trail if the removal is later disputed.

## 4. Counter-notice workflow

If the uploader believes the material was removed by mistake or
misidentification, they may submit a counter-notice under §512(g)(3),
which requires:

- their signature,
- identification of the material and where it appeared before removal,
- a statement under penalty of perjury of good-faith belief the
  material was removed by mistake or misidentification,
- their name, address, phone number, and consent to the jurisdiction of
  their local federal district court (and, if outside the US, an
  appropriate judicial district), plus consent to accept service of
  process from the original claimant.

Map this to a `notice.counter` record
([spec/003-kinds-registry.md](../../../../spec/003-kinds-registry.md)
§6.6): `regime = us-dmca-512`, `refs = [[0, <notice.takedown record id>]]`,
`claimant` = the counter-notifier's identity/contact,
`statement` covering the mistake/misidentification declaration plus the
jurisdiction-and-service consent, `signature_name`.

**Restore window:** under §512(g)(2)(C), once you receive a facially
valid counter-notice you must forward a copy to the original claimant,
then **replace the material not less than 10, nor more than 14,
business days** after receiving the counter-notice — *unless* your
designated agent first receives notice from the claimant that they've
filed a court action seeking a restraining order against the uploader.
Track this window per counter-notice; don't restore early (inside the
10-day floor gives the claimant no chance to seek an injunction) and
don't leave it past 14 business days without cause.

## 5. Repeat-infringer policy (required, not optional)

§512(i)(1)(A) conditions *every* §512 safe harbor on the service
provider having "adopted and reasonably implemented, and informed
subscribers ... of, a policy that provides for the termination in
appropriate circumstances of subscribers ... who are repeat infringers."
Practically:

- Write the policy down and publish it (link it from `AUP.md` §5 and
  `TERMS.md`).
- Track notices per identity/account, not just per record.
- Actually terminate accounts that accumulate valid takedowns under
  your stated thresholds — a policy you don't enforce is not
  "reasonably implemented" and can cost you the safe harbor for
  *everything*, not just the repeat infringer's content.
- Decide, and document, how a successful counter-notice or a disputed
  notice (`claim.dispute`,
  [spec/005-claims.md](../../../../spec/005-claims.md) §4) affects the
  count — a reversed or disputed takedown should not count as a strike
  in a policy you can defend as "reasonable."

## 6. Safe-harbor hygiene checklist

- [ ] Agent registered at dmca.copyright.gov, contact info current
- [ ] Agent contact published on the site and matches the registration
- [ ] Notice intake validates all six §512(c)(3)(A) elements
- [ ] Expeditious removal process with logging
- [ ] Counter-notice process with the 10–14 business day restore window
- [ ] Written, published, enforced repeat-infringer policy
- [ ] No practice of willfully ignoring "red flag" infringement (obvious
      infringement you didn't need a notice to recognize) — this is a
      knowledge question courts examine on the facts, not something a
      checklist item fixes by itself
- [ ] Staff who never had the ability to control and did not receive a
      direct financial benefit specifically tied to known infringing
      activity (the §512(c)(1)(B) prong) — talk to counsel if your
      business model ties revenue to specific creators' catalogs

## Official sources to check directly

- 17 U.S.C. §512 (full statutory text) — uscode.house.gov
- US Copyright Office DMCA Designated Agent Directory — dmca.copyright.gov
- US Copyright Office §512 study and guidance — copyright.gov

This guide summarizes mechanics at a practitioner-orientation level. It
does not restate every subsection, exception, or recent case law
development — have counsel confirm current requirements before you rely
on any of it.
