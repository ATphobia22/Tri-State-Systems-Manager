from __future__ import annotations


def main() -> None:
    """Launch the bundled Streamlit interface."""
    try:
        import streamlit.web.cli as stcli
    except ImportError as exc:
        raise SystemExit('Install UI dependencies with: pip install -e ".[ui]"') from exc

    import sys
    from pathlib import Path

    app_path = Path(__file__).with_name("webapp.py")
    sys.argv = ["streamlit", "run", str(app_path)]
    raise SystemExit(stcli.main())
