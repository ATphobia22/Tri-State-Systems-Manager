import os

from alembic import context
from sqlalchemy import create_engine, pool

url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
if context.is_offline_mode():
    context.configure(url=url, literal_binds=True, version_table="living_twin_alembic_version", version_table_schema="public")
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(url, poolclass=pool.NullPool).connect() as connection:
        context.configure(connection=connection, version_table="living_twin_alembic_version", version_table_schema="public")
        with context.begin_transaction():
            context.run_migrations()
