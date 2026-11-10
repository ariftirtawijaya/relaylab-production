# Deploy RelayLab Production to a VPS subpath

This guide serves the app at `https://relaylab.id/production/` while leaving the existing site at `https://relaylab.id/` in place. It assumes the VPS host already runs Nginx for the domain and has HTTPS configured.

## 1. Prepare the VPS

Install Docker Engine and the Docker Compose plugin using Docker's current instructions for your Linux distribution. Keep MongoDB private: this Compose file does not publish the MongoDB port.

Clone the repository:

```bash
sudo mkdir -p /opt/relaylab-production
sudo chown "$USER":"$USER" /opt/relaylab-production
git clone https://github.com/ariftirtawijaya/relaylab-production.git /opt/relaylab-production
cd /opt/relaylab-production
cp .env.example .env
nano .env
```

Before starting the containers, set these values in `.env`:

```env
EMERGENT_LLM_KEY=your-private-key
COOKIE_SECURE=true
CORS_ORIGINS=https://relaylab.id
PUBLIC_URL=/production
REACT_APP_BACKEND_URL=/production
FRONTEND_BIND=127.0.0.1
FRONTEND_PORT=8081
SEED_ADMIN_PASSWORD=replace-with-a-long-unique-password
SEED_PRODUCTION_PASSWORD=replace-with-a-different-long-password
SEED_QC_PASSWORD=replace-with-another-long-password
```

Keep `.env` only on the VPS. Do not put real keys or passwords in GitHub or send them in chat. The seed passwords are read only when MongoDB has no users, so set them before the first startup. If you have already initialized the database, change passwords through the application instead.

`EMERGENT_LLM_KEY` enables photo upload storage. The rest of the system can start without it, but uploads will fail.

## 2. Build and start

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:8081/api/health
```

The health check should return JSON with `"ok":true` and `"mongo":"up"`.

## 3. Add the Nginx reverse-proxy locations

Add the following inside the existing HTTPS `server { ... }` block for `relaylab.id`. This forwards only the `/production/...` requests to the app; the domain's current root site continues to be handled by its existing locations.

```nginx
location = /production {
    return 301 /production/;
}

location ^~ /production/ {
    client_max_body_size 10m;

    # The trailing slash removes /production/ before forwarding to the container.
    proxy_pass http://127.0.0.1:8081/;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Keep the session cookie scoped to this app's subpath.
    proxy_cookie_path / /production/;

    proxy_request_buffering off;
    proxy_buffering         off;
    proxy_connect_timeout   60s;
    proxy_send_timeout      300s;
    proxy_read_timeout      300s;
}
```

Then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If the domain is served by Apache, Caddy, or a hosting control panel instead, use its reverse-proxy equivalent rather than adding this Nginx block.

## 4. Verify in the browser

Open `https://relaylab.id/production/`, sign in as `arif` using the password set in `SEED_ADMIN_PASSWORD`, and change or create user accounts as needed. Confirm that a work-order page still loads after refreshing it and that API calls under `/production/api/` work.

To review logs:

```bash
docker compose logs -f backend frontend
```

To update after a code change:

```bash
git pull
docker compose up -d --build
```

Do not run `docker compose down -v` on the VPS; that deletes the production MongoDB data volume. Back up the database before destructive maintenance.
