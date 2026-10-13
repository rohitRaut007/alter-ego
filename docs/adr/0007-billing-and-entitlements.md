# ADR 0007: Billing and entitlements

Status: Accepted for entitlements; payments deferred · Date: 2026-10-13

## Context
Tiers: Core (protocol, Daily OS, Character Builder, Knowledge) and Full (Core + Presence, Legacy, Calendar). Pricing for India vs global is unanswered (PRD §14).

## Decision
- Model gating now: `Subscription(user, tier, status, source, current_period_end)`; `FeatureFlag` keys per tier in a static map (`billing/features.py`). DRF permission `HasFeature("presence")`. API responses expose `entitlements: [..]` so clients hide UI.
- During Alpha all invited users are granted `full` via an admin-set subscription (`source=grant`).
- **No payment code** until pricing is decided. The provider abstraction is a stub (`BillingProvider` interface).
- Entitlement checks happen server-side; clients are only advisory.

## Store billing (Apple and Google Play)
Per Apple's App Review Guidelines 3.1.1, features or content unlocked in an iOS app (including subscriptions) must use In-App Purchase; external purchase links are allowed in the US storefront and in regions with the StoreKit External Purchase Link Entitlement, not elsewhere. Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Verify again before submission since rules change.

Implications:
- Mobile subscribers must be able to buy via the store billing system (StoreKit / Play Billing, e.g. through RevenueCat), or the mobile app must be consumption-only for users who subscribed elsewhere (guideline allows this for multi-platform "reader"-style access; confirm applicability).
- Subscriptions must work on all the user's devices, so the entitlement source of truth is the backend, fed by Apple server notifications and the web provider.
- Apple takes a commission; price points differ between web and iOS.

## Consequences
- The mobile release (iOS and Android together) is blocked on a store-billing decision, not on build work. Google Play has an equivalent Play Billing requirement for digital subscriptions; verify its current policy before submission.
- Web payment provider (Razorpay for India, Stripe global) chosen with the pricing answer.
