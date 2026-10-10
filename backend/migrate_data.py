"""Copy all platform data from an old database to a new one.

    python migrate_data.py --from OLD_DATABASE_URL --to NEW_DATABASE_URL [--replace] [--dry-run]

--to defaults to DATABASE_URL from .env (the database this copy of the app uses),
so on the new server it's enough to pass --from with the old server's URL.
Or just double-click migrate.bat in the project folder."""
import argparse
import asyncio
import sys

from app.services.data_transfer import transfer


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="Copy platform data between PostgreSQL databases")
    p.add_argument("--from", dest="src", required=True, help="old database URL")
    p.add_argument("--to", dest="dst", help="new database URL (default: DATABASE_URL from .env)")
    p.add_argument("--replace", action="store_true", help="wipe data already in the new database first")
    p.add_argument("--dry-run", action="store_true", help="only count what would be copied")
    a = p.parse_args()
    if not a.dst:
        from app.config import settings
        a.dst = settings.DATABASE_URL

    print("قراءة قاعدة البيانات القديمة...")
    try:
        counts = asyncio.run(transfer(a.src, a.dst, replace=a.replace, dry_run=a.dry_run))
    except Exception as e:
        print(f"\n✗ النقل ما اكتملش ومفيش حاجة اتغيرت في قاعدة البيانات الجديدة:\n  {type(e).__name__}: {e}")
        sys.exit(1)
    total = sum(counts.values())
    print(f"\n{'هيتنقل' if a.dry_run else '✓ اتنقل'} {total} صف من {len(counts)} جدول.")


if __name__ == "__main__":
    main()
