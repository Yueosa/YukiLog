# Deployment rehearsal — 2026-10-04

## Result

The isolated deployment rehearsal passed on an official Ubuntu 24.04 rootfs
running under `systemd-nspawn`.

- Source release: `20261004T175310Z-dd6d6bef8583`
- Release SHA-256:
  `8fe7ea38471667e495bcffd1890b26ee02b1a6f15c7fe3b60eadaf25a02485bb`
- PostgreSQL, nginx and systemd ran inside a private mount, PID and network
  namespace.
- `YUKILOG_MAIL_ENABLED` remained `false`; the mail worker never ran.
- The host package inventory and all YukiLog production paths were identical
  before and after the rehearsal.

## Verified flows

1. Bootstrap from a clean Ubuntu rootfs.
2. Baseline migration against an empty PostgreSQL database.
3. Failed first deployment removes the invalid `current` link.
4. First healthy deployment and readiness check.
5. Administrator initialization.
6. Atomic healthy upgrade.
7. Failed upgrade restores the previous release.
8. Database and media backup with manifest verification.
9. Restore through a temporary database and atomic database rename.
10. Restored database and media sentinel values matched the backup.
11. Previous database and media directory remained available after restore.

The successful restore used backup
`20261004T182903Z-728553214`. Both database and media sentinels returned
`before-backup`.

## Defects found and fixed

- An absent `current` path was incorrectly treated as a previous release
  because `readlink -f` resolves a missing final path.
- The root-only backup directory prevented the PostgreSQL process from opening
  the dump.
- Mixed-case temporary database identifiers were folded by unquoted SQL.
- Restored objects became owned by `postgres` instead of the application role.
- Rapid controlled failure/recovery operations could hit systemd's start rate
  limit.
- Backup IDs could collide when multiple operations ran in the same second.
- Restore could start the mail worker based on SMTP configuration even when the
  global mail switch was disabled.

## Isolation evidence

The host package inventory hash was unchanged:

`1020ab108ab7dc0fa9f35e8b7cb1630e91879ef57a5daaae9c7b17fc045b3669`

These host paths were absent both before and after the run:

- `/etc/yukilog`
- `/var/www/yukilog`
- `/var/lib/yukilog`
- `/var/backups/yukilog`

The temporary rootfs, package cache and full runtime logs remain under the
ignored `.rehearsal/` directory until `ops/rehearsal/cleanup.sh` is run.

## Remaining production-only checks

- Real DNS and Let's Encrypt issuance for `blog.yeastar.xin`.
- Administrator-only SMTP canary before enabling subscriber delivery.
- Final server firewall, SSH and provider security-group review.
