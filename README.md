# ScorePath Production

A mobile-friendly IELTS + PTE learning platform starter designed for simple cloud deployment.

## Included
- Student registration/login with hashed passwords
- IELTS and PTE original lesson content
- Live-class schedule
- Practice test engine
- Student dashboard
- Admin API foundation
- Razorpay order creation + signature verification
- ₹200 monthly and ₹500 three-month plans
- Responsive mobile UI
- Health endpoint
- Environment-variable configuration

## Deploy from a phone
1. Create a GitHub repository.
2. Upload all project files (do not upload `.env`).
3. Create a Render Web Service and connect the GitHub repository.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables from `.env.example`.
7. Deploy and test `/api/health`.
8. Add your custom domain after the service works.

## Important
This project does not contain or require your bank account, UPI PIN, card number, password or OTP.

For real payments, create and verify your own Razorpay account, then add the Razorpay API keys in the hosting provider's environment variables. Never commit those keys to GitHub.

The included JSON data store is intended for this deployment package's simple launch/testing stage. For significant production traffic, migrate users/subscriptions/content to PostgreSQL or another managed database.

The platform is independent and must not be presented as officially affiliated with IELTS or Pearson PTE.

## Admin
The current admin API is prepared for an admin user. The initial admin credentials should be created securely before launch; do not hard-code a real password into source control.

## Local run
- Install Node.js 20+
- Run `npm install`
- Copy `.env.example` to `.env`
- Set a strong SESSION_SECRET and admin credentials
- Run `npm start`
- Open http://localhost:3000


## Vercel deployment

This project includes `api/index.js` and `vercel.json` for Vercel serverless deployment.
Set these environment variables in Vercel if using payments:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Important: Vercel serverless functions do not provide a persistent local database. The JSON database is therefore only suitable for demo/testing on Vercel. For production accounts, sessions, and subscriptions, connect a persistent database (for example PostgreSQL).
