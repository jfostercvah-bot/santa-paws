# Santa Paws website

The site is six plain HTML pages: `index.html` (home), `photos.html`, `treats.html`, `vendors.html`, `gallery.html`, `faq.html`, `contact.html`. Each page is self-contained (no build step needed to host).

- **Placeholders** in [square brackets] need real details: clinic name, date, hours, address, prices, contact info.
- **Forms** (photo sign-up, vendor application, contact): delivered by Web3Forms to the email tied to `FORM_KEY` near the bottom of each page, so the address never appears on the site. Empty key = preview mode.
- **Photo slots**: every 5 minutes, 10:00 to 11:55 AM and 1:00 to 2:55 PM, up to 2 pets per spot (3+ pets hold back-to-back spots). Add filled times to the `booked` list in the script to cross them out.
- **Gallery**: the `shots` list holds caption + year; swap the paw placeholders for real photos.
- **Hosting**: GitHub Pages from the `main` branch, served at https://cvahsantapaws.com (domain registered on Cloudflare; the `CNAME` file sets it).
