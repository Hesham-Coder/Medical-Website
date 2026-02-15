# Backup and Restore

This project includes local backup and restore scripts for:
- `data/`
- `uploads/`

## Create a backup

```bash
npm run backup
```

Creates a zip file in `backups/` with name format:

`backup-YYYY-MM-DD-HH-mm.zip`

## Restore from latest backup

```bash
npm run restore
```

## Restore from a specific backup

```bash
node restore.js backups/backup-2026-02-15-14-30.zip
```

Restoring overwrites existing files in `data/` and `uploads/`.
