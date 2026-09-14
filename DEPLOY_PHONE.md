# Phone-only deployment checklist

## A. GitHub
1. Open GitHub in Safari/Chrome.
2. Create a new repository named `scorepath-ielts-pte`.
3. Upload the files from this ZIP.
4. Make sure `.env` is NOT uploaded.

## B. Render
1. Open Render and sign in with GitHub.
2. New → Web Service.
3. Select the ScorePath repository.
4. Runtime: Node.
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Choose a suitable instance.
8. Add environment variables:
   - NODE_ENV=production
   - SESSION_SECRET=<long random value>
   - ADMIN_EMAIL=<your admin email>
   - ADMIN_PASSWORD=<strong admin password>
   - APP_URL=<your Render URL initially>
9. Deploy.

## C. Payment
Do not enter bank details into source code.
1. Create/verify your own Razorpay account.
2. Obtain the API credentials from Razorpay.
3. Add them to Render environment variables:
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
4. If you use Razorpay subscriptions/plans, also add the plan IDs.
5. Test with the payment provider's test mode before accepting live money.

## D. Domain
Buy a domain from a registrar, then add it in Render and follow the DNS records Render gives you.

## E. Before public launch
- Enable HTTPS (Render handles this for its service/domain setup).
- Use a strong SESSION_SECRET.
- Use a real managed database before scaling.
- Add your refund/privacy/terms details.
- Add real live-class links.
- Test registration, login, payment, mobile layout and logout.
