# Admin Dashboard

## Environment setup

Create `.env` from `.env.example` and configure required values:
- `SESSION_SECRET`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`
- Redis connection (`REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`)

Credentials must be configured via environment variables.

## Run

```bash
npm install
npm start
```

## Backup and restore

Create local backup zip for `data/` and `uploads/`:

```bash
npm run backup
```

Restore from latest backup:

```bash
npm run restore
```

Restore from a specific file:

```bash
node restore.js backups/backup-YYYY-MM-DD-HH-mm.zip
```
