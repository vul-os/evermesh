---
title: Geo-blocking
---

**Template — not legal advice.** This explains the per-item geo-block
feature of the policy engine and how to use it honestly. Have counsel
confirm whether geo-blocking (rather than full removal) is an adequate
response to a given legal notice in your jurisdiction — it often is not
a substitute for full compliance, only a narrower tool for narrower
orders.

# Per-item geo-blocking

## What it is

The gateway's policy engine
([spec/009-gateway.md](../../../../spec/009-gateway.md) §1, build plan
§9) supports flagging individual items ("this manifest") as blocked in
specific regions, instead of removing them from {{GATEWAY_NAME}}
entirely. This is local configuration — instant, reversible, and logged
like any other selection decision — not a protocol feature. The
substrate has no concept of country; geo-blocking exists entirely at
the gateway's serving layer, based on how you determine a viewer's
location (IP geolocation, account locale, or similar signals you
choose and should document).

## Why it exists

Some legal orders are properly scoped to a country. A court can order
"block this video for viewers in Country X" without ordering
{{GATEWAY_NAME}} to stop serving it everywhere, and it is more honest —
and better for viewers outside the order's scope — to block only where
the order actually applies, rather than defaulting to a global takedown
because a per-region control wasn't available.

**Example:** a court in Country X issues an injunction against a
specific video for defamation, valid only within Country X's
jurisdiction. Rather than de-index the manifest globally (over-broad:
viewers elsewhere have no obligation to lose access) or ignore the
order (non-compliant in Country X), you geo-block the manifest for
Country X viewers only, and continue serving it everywhere else.

Geo-blocking is also a legitimate tool for content that's lawful in
general but restricted in specific places for reasons unrelated to a
takedown notice — age-rating regimes, gambling advertising rules, or
similar region-specific regulatory categories, where your policy is to
comply narrowly rather than withdraw the content from every region.

## Honesty requirements

- **Label it.** Where law permits disclosure, tell the affected viewer
  *that* content is blocked in their region and, at minimum, that it's
  a legal/regulatory block rather than "this video doesn't exist" or a
  generic error. A silent 404 for a geo-blocked item is misleading by
  omission.
- **Don't use it to launder scope.** If a notice or order actually
  requires global removal, geo-blocking one region while continuing to
  serve everywhere else is not compliance — it's a workaround that will
  read as bad faith if it's ever examined. Match the block's scope to
  what the underlying legal instrument actually requires, not to
  whatever minimizes viewer complaints.
- **Log the basis.** Every geo-block should record which notice, order,
  or policy justified it, same as any other selection action
  ([spec/009-gateway.md](../../../../spec/009-gateway.md) §1). If you
  later face a counter-notice or dispute, you need to be able to show
  why the block exists and at what scope.
- **It's still just your selection.** A geo-block on {{GATEWAY_NAME}}
  does nothing to the underlying record or blob. A viewer in a blocked
  region can still reach the same content through another gateway, a
  relay directly, or P2P retrieval — say this plainly if you're
  explaining the block to a regulator or a user, the same way `TERMS.md`
  §1 is plain about takedowns generally.

## What geo-blocking cannot do

Geo-blocking cannot enforce itself against a determined viewer using a
VPN or a different gateway — it is a good-faith access control at your
serving layer, not a security boundary. Do not describe it to regulators
or in your transparency reporting as a leakproof guarantee; describe it
accurately as "we do not knowingly serve this to viewers we identify as
being in region X."
