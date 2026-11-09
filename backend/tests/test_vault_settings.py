"""Regression: settings must actually be wired to config/vault_client.py.
It was imported as `.vault_client` from config.settings (a module that
doesn't exist), so the ImportError was swallowed and Vault was never
consulted — CI's scripts/ci_vault_acceptance.py is the end-to-end check;
these keep the wiring from silently breaking again."""

import importlib


def test_base_settings_import_the_real_vault_helper():
    from config import vault_client
    from config.settings import base

    assert base._get_secret_from_vault is vault_client.get_secret


def test_fetch_secret_prefers_vault_then_env(monkeypatch):
    from config.settings import base

    monkeypatch.setattr(base, "_get_secret_from_vault", lambda name, default=None: f"vault-{name}")
    assert base._fetch_secret("ANYTHING", default="d") == "vault-ANYTHING"

    monkeypatch.setattr(base, "_get_secret_from_vault", lambda name, default=None: None)
    monkeypatch.delenv("NOT_SET_ANYWHERE", raising=False)
    assert base._fetch_secret("NOT_SET_ANYWHERE", default="fallback") == "fallback"


def test_vault_helper_is_inert_without_vault_env(monkeypatch):
    import config.vault_client as vc

    monkeypatch.delenv("VAULT_ADDR", raising=False)
    monkeypatch.delenv("VAULT_TOKEN", raising=False)
    vc = importlib.reload(vc)
    try:
        assert vc.get_secret("SECRET_KEY", default="dflt") == "dflt"
    finally:
        importlib.reload(vc)


def test_production_settings_reference_the_real_vault_helper():
    from pathlib import Path

    source = (Path(__file__).resolve().parents[1] / "config" / "settings" / "production.py").read_text()
    assert "from config.vault_client import get_secret" in source
    assert "from .vault_client" not in source
