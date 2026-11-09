# Calendar storage on HostGator

The calendar uses Firebase Authentication for login and the HostGator MySQL database for notes and file contents. Files are stored as `LONGBLOB` values, not as public files on the web server.

## 1. Create the tables

In cPanel, open **phpMyAdmin**, select the database created for the site, open the **SQL** tab, and run [`schema.sql`](./schema.sql).

## 2. Configure the private database connection

Copy [`calendar-config.example.php`](./calendar-config.example.php) to `calendar-config.php` in the account's home directory, one level above `public_html`. For example:

```text
/home/CPANEL_USER/calendar-config.php
/home/CPANEL_USER/public_html/api/calendar.php
```

Replace the database name, user, and password with the exact values from cPanel. cPanel prefixes database and user names with the account name. Keep the real `calendar-config.php` outside `public_html`; do not commit or upload it into the repository.

The allowed origins must match the website's address exactly. If the site uses a different domain, update `allowed_origins` in the private config. For local Vite development, temporarily add `http://localhost:5173`.

## 3. Upload the PHP endpoint

Create `public_html/api` if needed and upload [`api/calendar.php`](./api/calendar.php) there. The endpoint expects the private configuration at the path above.

Enable PHP 8.0 or newer and these extensions in cPanel:

- PDO MySQL
- cURL
- OpenSSL
- Fileinfo

The endpoint validates each Firebase ID token against the `hora-do-foco` Firebase project before accessing the database. Do not remove that check or expose database credentials in frontend files.

## 4. Set upload limits

In cPanel's **MultiPHP INI Editor**, set `upload_max_filesize` to at least `16M` and `post_max_size` to at least `18M`. The app accepts files smaller than 15 MB. The MySQL server's `max_allowed_packet` must also be greater than 15 MB; if HostGator does not permit changing it and uploads fail, contact their support.

Because file contents are stored in MySQL, they count against database storage and backups. Keep this in mind when choosing the account's database plan.

## 5. Build and deploy the frontend

Build and publish the frontend as usual. It calls `https://horadofoco.com/api/calendar.php` by default. To use a different API address, set `VITE_CALENDAR_API_URL` before running the production build.

New calendar entries and uploads will be stored in MySQL. Existing records in Firebase are not deleted or migrated by this change.
