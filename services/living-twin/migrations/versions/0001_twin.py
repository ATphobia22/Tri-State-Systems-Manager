"""Install the temporal living twin schema."""
from pathlib import Path

from alembic import context, op

revision = "0001_twin"
down_revision = None
branch_labels = None
depends_on = None


def execute(direction):
    sql = (Path(__file__).parents[1] / "sql" / f"0001.{direction}.sql").read_text()
    if context.is_offline_mode():
        context.get_context().impl.static_output(sql)
    else:
        # Supplying no parameters uses the simple PostgreSQL protocol for the SQL batch.
        op.get_bind().exec_driver_sql(sql, execution_options={"no_parameters": True})


def upgrade():
    execute("up")


def downgrade():
    execute("down")
