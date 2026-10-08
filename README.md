# Santa Paws website

Plain HTML pages served by GitHub Pages at https://cvahsantapaws.com: `index.html` (home), `photos.html`, `treats.html`, `vendors.html`, `gallery.html`, `sponsors.html`, `faq.html`, `contact.html`, plus `cancel.html` (cancel links) and `admin.html` (password-protected admin page). Each page is self-contained.

- **Sign-ups**: forms post to the sign-up service at https://api.cvahsantapaws.com (`API_URL` in each page's script). It stores photo bookings, vendor applications, messages and sponsors in a Cloudflare D1 database, refuses double-booked photo times and a 16th vendor, and tells the pages which times are taken and how many spots are left. Pages refresh that every 30 seconds.
- **Emails**: after each sign-up is saved, the page also sends a copy through Web3Forms (`FORM_KEY`) to the clinic's inbox, so the address never appears on the site. People cancel on `cancel.html` by entering the email and phone they signed up with (or with a `?code=` link).
- **Admin page**: `admin.html` lists bookings (in photo-time order), vendors, sponsors and messages. Deleting a row frees its spot; sponsors added there appear on the home page and count toward each level. Each list downloads as CSV.
- **Sign-up service code**: `worker/` (Cloudflare Worker + `migrations/` for the database). `.github/workflows/deploy-api.yml` deploys it on every push that changes `worker/`, using repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ADMIN_PASSWORD` (changing the password secret takes effect on the next deploy; run the workflow by hand from the Actions tab).
- **Photo slots**: every 5 minutes, 10:00 to 11:55 AM and 1:00 to 2:55 PM, up to 2 pets per spot (3+ pets hold back-to-back spots).
- **Gallery**: the `shots` list holds caption + year; swap the paw placeholders for real photos.
- **Domain**: registered on Cloudflare; the `CNAME` file points GitHub Pages at it.
