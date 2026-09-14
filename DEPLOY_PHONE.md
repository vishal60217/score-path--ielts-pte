# ScorePath — iPhone deployment

## 1. GitHub
Upload the **contents of this `scorepath_prod` folder** to the root of your existing GitHub repository.

Do not upload the `scorepath_prod` folder as a nested folder.

If the old repository has an `api` folder or an old `vercel.json` from an earlier ScorePath build, remove those old files first.

## 2. Vercel
Open the existing **ScorePath IELTS PTE** project. Do not create another project.

Go to **Settings → Environment Variables** and add:

- `DATABASE_URL` = the complete Neon PostgreSQL connection string
- `DATABASE_SSL` = `true`
- `ADMIN_EMAIL` = your admin email
- `ADMIN_PASSWORD` = your strong admin password

Select **Production** for each variable. You may also select Preview if you want preview deployments to use the same database.

## 3. Deploy
Push/commit the GitHub changes. Vercel will create a new deployment. Vercel environment-variable changes apply to new deployments, so redeploy after changing variables.

## 4. Check health
Open:

`https://YOUR-VERCEL-DOMAIN/api/health`

A healthy production response contains:

`"ok":true`

and

`"productionReady":true`

## 5. Admin login
Open the site → **Login** → use the exact `ADMIN_EMAIL` and `ADMIN_PASSWORD` configured in Vercel.

The account button becomes **Admin** after login.

## 6. Bank / UPI payments
Login as Admin → **Admin → Bank & settings**.

Enter:
- Bank name
- Account name
- Account number
- IFSC
- UPI ID
- Support email

Save.

Students can then choose a membership plan, transfer the exact amount, submit their UTR, and the admin can approve it from **Admin → Payments**.

## 7. Razorpay (optional)
If you want online card/UPI checkout through Razorpay, also add:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Then redeploy.

## Important
A real PostgreSQL database is required for persistent Vercel production data. Do not rely on the local JSON fallback for production.
