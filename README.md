# ScorePath — Modern Production LMS

A responsive IELTS, PTE, Academic English, Vocabulary & Grammar learning platform designed for Vercel + PostgreSQL/Neon.

## Included

- Modern editorial / subtle vintage UI
- Mobile-first navigation
- Student registration and login
- Secure server-side sessions
- IELTS, PTE, Academic English, Vocabulary & Grammar tracks
- Lessons protected by active membership
- Progress tracking
- Diagnostic test
- Membership plans and expiry/renewal
- Manual bank/UPI payment + UTR verification workflow
- Optional Razorpay checkout
- Admin dashboard
- Course management
- Lesson management
- Membership plan management
- Teacher/instructor management
- Live class management with meeting links
- Payment approval/rejection
- Bank/UPI settings
- Registered-user overview
- PostgreSQL persistence
- Safe database migrations for older ScorePath schema versions
- `/api/health` diagnostics

## Production requirements

Use a real PostgreSQL database such as Neon on Vercel. Set:

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Optional:

- `ADMIN_NAME`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `SUPPORT_EMAIL`

Razorpay is optional. Manual bank/UPI payment works without Razorpay after an admin enters bank details in the Admin panel.

## Deployment

Vercel supports Express deployments without a custom `vercel.json` in this project. Upload the project files at repository root, connect the GitHub repo to the existing Vercel project, configure the environment variables, and redeploy.

After deployment, check `/api/health`.

## Testing note

Syntax validation was run on the final JavaScript files. Full live PostgreSQL, Vercel and Razorpay integration cannot be verified in this offline build environment without the user's actual credentials/services. The app is structured for those production services and includes database migration/error handling, but live credentials must still be configured and the deployed site should be tested end-to-end.
