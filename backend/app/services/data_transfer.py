"""Copy all platform data from one PostgreSQL database to another.

Used when moving the platform (cloud → own server, Neon → local Postgres, ...).
The target gets the current schema first (same as app startup), then every
table is copied in foreign-key order inside ONE transaction — if anything
fails, the target is left untouched. Files (Supabase) and search vectors
(Qdrant) live in their own services and keep working as long as the new
server uses the same SUPABASE_* / QDRANT_* settings."""
import importlib
import pkgutil

from sqlalchemy import bindparam, func, inspect, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

import app.models
from app.database import Base, init_db

# Register every model module so Base.metadata knows all tables.
for _m in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{_m.name}")

BATCH = 1000


def normalize_url(url: str) -> str:
    """Accept the URL as Neon/Supabase/pgAdmin print it (postgres://...?sslmode=require)."""
    u = make_url(url.strip())
    q = dict(u.query)
    if "sslmode" in q:  # asyncpg spells it ssl=
        q["ssl"] = q.pop("sslmode")
    q.pop("channel_binding", None)
    return u.set(drivername="postgresql+asyncpg", query=q).render_as_string(hide_password=False)


def _same_db(a: str, b: str) -> bool:
    ua, ub = make_url(a), make_url(b)
    return (ua.host, ua.port, ua.database) == (ub.host, ub.port, ub.database)


async def _counts(conn, tables) -> dict[str, int]:
    return {t.name: (await conn.execute(select(func.count()).select_from(t))).scalar_one() for t in tables}


async def transfer(src_url: str, dst_url: str, *, replace: bool = False, dry_run: bool = False, log=print) -> dict[str, int]:
    src_url, dst_url = normalize_url(src_url), normalize_url(dst_url)
    if _same_db(src_url, dst_url):
        raise ValueError("المصدر والهدف نفس قاعدة البيانات")
    src = create_async_engine(src_url)
    dst = create_async_engine(dst_url)
    try:
        async with src.connect() as s:
            src_cols = await s.run_sync(lambda c: {
                t: {col["name"] for col in inspect(c).get_columns(t)} for t in inspect(c).get_table_names()
            })
            tables = [t for t in Base.metadata.sorted_tables if t.name in src_cols]
            counts = await _counts(s, tables)
        for name in sorted(set(src_cols) - {t.name for t in Base.metadata.sorted_tables}):
            log(f"  تجاهل جدول مش مستخدم في البرنامج: {name}")
        for name, n in counts.items():
            log(f"  {name}: {n}")
        if dry_run:
            return counts

        log("تجهيز الجداول في قاعدة البيانات الجديدة...")
        await init_db(dst)

        async with src.connect() as s, dst.begin() as d:
            existing = {k: v for k, v in (await _counts(d, Base.metadata.sorted_tables)).items() if v}
            if existing and not replace:
                raise RuntimeError(
                    "قاعدة البيانات الجديدة فيها بيانات بالفعل: "
                    + ", ".join(f"{k}={v}" for k, v in existing.items())
                    + " — استخدم --replace لمسحها والنسخ فوقها"
                )
            if existing:
                names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
                await d.execute(text(f"TRUNCATE {names} CASCADE"))

            for t in tables:
                cols = [c for c in t.columns if c.name in src_cols[t.name]]
                # A row can point at another row of the same table (users.teacher_id):
                # insert those links empty, then fill them in once all rows exist.
                self_fks = [fk.parent.name for fk in t.foreign_keys if fk.column.table is t and fk.parent.name in src_cols[t.name]]
                pk = [c.name for c in t.primary_key.columns]
                links = {col: [] for col in self_fks}
                result = await s.stream(select(*cols))
                async for part in result.partitions(BATCH):
                    rows = [dict(r._mapping) for r in part]
                    for row in rows:
                        for col in self_fks:
                            if row[col] is not None:
                                links[col].append({**{f"pk_{k}": row[k] for k in pk}, "v": row[col]})
                                row[col] = None
                    await d.execute(t.insert(), rows)
                for col, params in links.items():
                    if params:
                        stmt = update(t).where(*(t.c[k] == bindparam(f"pk_{k}") for k in pk)).values(
                            {col: bindparam("v"), **{c.name: c for c in t.columns if c.onupdate is not None}}  # keep updated_at as copied
                        )
                        await d.execute(stmt, params)
                log(f"  ✓ {t.name} ({counts[t.name]})")

            # Integer auto-increment keys must continue after the copied rows.
            for t in tables:
                for c in t.primary_key.columns:
                    if c.autoincrement is True or (c.autoincrement == "auto" and c.type.python_type is int and len(t.primary_key.columns) == 1):
                        await d.execute(text(
                            f"SELECT setval(pg_get_serial_sequence('{t.name}', '{c.name}'), "
                            f"COALESCE((SELECT MAX(\"{c.name}\") FROM \"{t.name}\"), 0) + 1, false) "
                            f"WHERE pg_get_serial_sequence('{t.name}', '{c.name}') IS NOT NULL"
                        ))

            copied = await _counts(d, tables)
            bad = {k: (counts[k], v) for k, v in copied.items() if v != counts[k]}
            if bad:
                raise RuntimeError(f"عدد الصفوف مش مطابق: {bad}")
        return counts
    finally:
        await src.dispose()
        await dst.dispose()
