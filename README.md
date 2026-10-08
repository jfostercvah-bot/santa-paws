# Santa Paws website

`index.html` is the whole site (one file, no build step).

- **Placeholders** in [square brackets] need real details: clinic name, date, hours, address, prices, contact info.
- **Sign-up forms**: create a free form at formspree.io, then paste its URL into `FORM_ENDPOINT` near the bottom of `index.html`. Sign-ups then arrive by email.
- **Photo slots**: every 5 minutes, 10:00 to 11:55 AM and 1:00 to 2:55 PM, up to 2 pets per spot (3+ pets hold back-to-back spots). Add filled times to the `booked` list in the script to cross them out.
- **Gallery**: the `shots` list holds caption + year; swap the paw placeholders for real photos.
- **Hosting**: GitHub Pages from the `main` branch, served at https://cvahsantapaws.com (domain registered on Cloudflare; the `CNAME` file sets it).
