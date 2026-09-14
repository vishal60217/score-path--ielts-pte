# ScorePath — Production Learning Platform

ScorePath is an Express-based LMS for IELTS, PTE, Academic English, Vocabulary and Grammar.

## Included
- Student registration/login
- Protected paid lessons
- Membership plans with course entitlements and expiry
- Renewal/extension after expiry
- Razorpay checkout + signature verification
- Manual bank/UPI payment with UTR and admin approval
- Admin CMS for courses, lessons, plans, teachers, live classes and payment approvals
- Student progress tracking
- Diagnostic practice test
- PostgreSQL persistence for production
- Local JSON fallback for development only

## Production requirement
For Vercel production, set `DATABASE_URL` to a managed PostgreSQL database. Vercel's runtime filesystem is not a durable database. The app automatically creates its tables and seeds initial content on first startup.

## Vercel environment variables
Set the variables in `.env.example` in **Project → Settings → Environment Variables**, then redeploy. Vercel documents environment variables under project settings. Do not commit real secrets to GitHub.

Minimum:
- DATABASE_URL
- ADMIN_EMAIL
- ADMIN_PASSWORD

For online payments:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET

For bank/UPI payment you can use the admin panel to enter the receiving details.

## Local development
```bash
npm install
cp .env.example .env
npm start
```
Without `DATABASE_URL`, local development uses `data/db.json`. Do not use that fallback as production storage.
