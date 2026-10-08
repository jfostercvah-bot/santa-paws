# Santa Paws website

`index.html` is the whole site (one file, no build step).

- **Placeholders** in [square brackets] need real details: clinic name, date, hours, address, prices, contact info.
- **Sign-up forms**: create a free form at formspree.io, then paste its URL into `FORM_ENDPOINT` near the bottom of `index.html`. Sign-ups then arrive by email.
- **Photo slots**: booked times are the `booked` list in the script; the schedule (10:00 to 3:00, 10-minute slots, lunch 12:00 to 12:30) is the loop below it.
- **Gallery**: the `shots` list holds caption + year; swap the paw placeholders for real photos.
- **Hosting**: GitHub Pages from the `main` branch, served at https://cvahsantapaws.com (domain registered on Cloudflare; the `CNAME` file sets it).
