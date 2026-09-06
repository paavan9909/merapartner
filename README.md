# Companio Marketplace

A starter marketplace for adult, non-sexual companionship and social experiences.

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your Razorpay **test** Key ID and Key Secret in `.env`.
5. Run `npm start`.
6. Open http://localhost:3000

## Payments
The site uses Razorpay Standard Checkout. A server-side order is created before checkout. Do not put the Razorpay secret in browser JavaScript. Before going live, add server-side signature verification and webhooks, then switch to live keys.

## Production architecture
- Frontend + API: Vercel
- Auth/database/storage: Supabase
- Payments: Razorpay
- Custom domain: optional

Do not launch with fake verification or demo profiles. Replace them with real onboarding, identity verification, moderation, terms, privacy policy, cancellation/refund rules, and local legal/tax review.
