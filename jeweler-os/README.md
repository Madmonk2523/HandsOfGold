# Hands of Gold OS — Jeweler Sales MVP

A standalone prototype for a jewelry-specific sales operating system. This lives in `/jeweler-os` on the `jeweler-os-mvp` branch so it does not modify the live Hands of Gold store site.

## What the MVP proves

The first product is deliberately narrow: **never lose a jewelry lead**.

The prototype includes:

- Jewelry lead pipeline with stages from inquiry through won/lost
- Pipeline value, open-lead, follow-up, and closed-sale KPIs
- Follow-up priority list
- Custom jewelry workflow board
- Jewelry-specific sales-message generator
- Browser persistence with `localStorage`
- Responsive desktop/mobile UI
- Founding-customer pricing and beta request flow

## Founding offer

**First 10 jewelers: $299/month**

- One location
- Unlimited staff during beta
- White-glove onboarding
- Lead pipeline
- Custom-job workflow
- Follow-up dashboard
- Sales assistant
- Direct founder feedback channel
- Price locked for 12 months
- Cancel anytime

The purpose of the founding offer is learning and retention, not maximizing price. After the product proves value, target standard pricing is expected to move toward $499+/month based on features and usage.

## How to run locally

This is a static prototype. From the `jeweler-os` folder, serve the directory with any static web server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Vercel deployment

Create a **new** Vercel project for this product instead of attaching it to the Hands of Gold production store.

Recommended project settings:

- Repository: `Madmonk2523/HandsOfGold`
- Branch: `jeweler-os-mvp`
- Root Directory: `jeweler-os`
- Framework Preset: Other / Static
- Build Command: none
- Output Directory: `.`

Do not point `handsofgoldny.com` at this project. Use a temporary Vercel URL during customer validation, then choose a dedicated SaaS domain after naming/trademark review.

## What must be built before taking live customer data

The prototype intentionally uses browser storage. Before real beta onboarding, replace it with production infrastructure:

1. Authentication and multi-tenant organizations
2. Persistent database with tenant isolation
3. Staff roles and permissions
4. Server-side lead/custom-job APIs
5. Activity history and audit trail
6. Secure customer/contact data handling
7. Production email/SMS integrations with consent controls
8. Billing and subscription management
9. Backups and export
10. Basic analytics and error monitoring

## 30-day validation target

Do not add inventory, POS, accounting, or dozens of modules yet.

### Week 1
- Deploy private demo
- Use Hands of Gold as Store #001
- Enter real workflows manually without sensitive customer data
- Fix friction in the lead stages and custom-job stages

### Week 2
- Demo to 20 independent jewelers
- Ask each owner where leads are lost today
- Track objections and requested integrations
- Close the first 2 founding stores

### Week 3
- Build persistent multi-tenant backend around the behaviors the first users actually use
- Add onboarding and import
- Start charging founding users

### Week 4
- Reach 5-10 paying stores
- Measure weekly active staff, leads created, follow-ups completed, deposits/closed sales influenced, churn risk

## Product rule

Every feature must answer at least one of these:

1. Does it help a jeweler capture more opportunities?
2. Does it help staff follow up faster?
3. Does it help move a custom job toward a deposit?
4. Does it help the owner see where revenue is stuck?
5. Will a jeweler pay for it or keep paying because of it?

If not, it waits.
