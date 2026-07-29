# BrainServe data retention and legal-hold runbook

## Lifecycle

1. PostgreSQL keeps operational rows and monthly history partitions.
2. A dataset becomes archive eligible after its configured warm-storage period.
3. Active dataset, partition, subject, legal-hold, or investigation records block
   every destructive lifecycle step.
4. The archive worker writes GZIP JSON Lines through AES-256-GCM encryption to
   the private S3-compatible bucket.
5. The worker downloads the object again, checks SHA-256, decrypts it, validates
   every JSON record, and confirms the restored row count.
6. Only a `VERIFIED` archive with a completed restore test can be detached and
   removed from PostgreSQL.
7. At policy expiry, every object version and delete marker is removed. Former
   employee and appointment rows are anonymized; eligible visitor profiles are
   deleted.
8. Base backups and WAL expire through their independent backup lifecycle.
9. Every policy, hold, archive, restore, removal, anonymization, deletion, and
   backup-expiry action is appended to `data_governance_log`.

## Required production configuration

Generate an independent 256-bit archive key:

```bash
openssl rand -base64 32
```

Configure it without committing it:

```text
ARCHIVE_ENCRYPTION_KEYS=v1=<generated-base64-key>
ARCHIVE_ENCRYPTION_ACTIVE_KEY_VERSION=v1
```

For rotation, keep both keys configured until all `v1` objects have expired:

```text
ARCHIVE_ENCRYPTION_KEYS=v1=<old-key>,v2=<new-key>
ARCHIVE_ENCRYPTION_ACTIVE_KEY_VERSION=v2
```

Losing an old key makes its cold archives unrecoverable.

## Legal holds and investigations

- Only System Admin can place or release a hold.
- `DATASET` blocks the complete dataset.
- `PARTITION` blocks one monthly archive partition.
- `SUBJECT` blocks one record or person. For archive safety, any active subject
  hold conservatively prevents disposal of that dataset's mixed archive.
- A review date is a reminder, not an automatic release.
- Releasing a hold requires a reason and creates another immutable ledger entry.
- Never release a hold without written authority tied to its case reference.

## Restore test before database removal

The automated restore test is successful only when all three checks pass:

- downloaded encrypted bytes match the manifest SHA-256;
- AES-GCM authentication and GZIP decompression finish without error;
- every JSON row parses and the restored count equals the database count.

If any check fails, the object is removed, the manifest becomes `FAILED`, and
the PostgreSQL partition remains attached.

## Backup lifecycle

- `POSTGRES_BACKUP_RETENTION_DAYS` controls physical base backups.
- `POSTGRES_WAL_RETENTION_DAYS` controls archived WAL and must be at least the
  base-backup window.
- `BACKUP_LIFECYCLE_RETENTION_DAYS` records when disposed data is expected to
  have aged out of every recoverable backup.
- Physical backups cannot remove one person's rows selectively. Keep expired
  restores isolated and rerun retention before permitting application access.

Run a monthly restore drill using `ops/postgres/PITR_RUNBOOK.md` and keep the
result with the governance evidence for that month.
