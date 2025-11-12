# Simple asyncpg connection helper for the app
# Uses DATABASE_URL from environment. Provides a shared connection pool.

import os
import asyncpg
from typing import Optional

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create a global asyncpg pool.

    The pool is cached in module state to avoid recreating it for each request.
    """
    global _pool
    if _pool is None:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            # In Riff, DATABASE_URL is provided as a secret in both dev and prod
            raise RuntimeError("DATABASE_URL is not configured")
        # Min pool size 1 to keep footprint small; adjust later if needed
        _pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)
    return _pool


async def fetchrow(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def executemany(query: str, args_list):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.executemany(query, args_list)
