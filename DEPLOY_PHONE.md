# Deploy ScorePath from a phone

1. Upload the project files to the root of the GitHub repository.
2. Do not upload `.env` or real secrets.
3. Import the repository into Vercel.
4. In Vercel → Settings → Environment Variables add `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and the Razorpay variables if using online payments.
5. Redeploy after saving environment variables.
6. Open `/api/health`. Production should report `database: postgres` and `productionReady: true`.
7. Open the site and log in with the admin credentials.

For a real business, use a managed PostgreSQL database and a real Razorpay account. Test payments before accepting customers.
