from protocol import contract


def test_exported_contract_files_match_the_pydantic_models():
    """Fails when the schema changes without re-running `manage.py export_protocol_contract`."""
    assert contract.SCHEMA_PATH.read_text(encoding="utf-8") == contract.schema_json()
    assert contract.EXAMPLE_PATH.read_text(encoding="utf-8") == contract.example_json()
    assert contract.MINIMAL_PATH.read_text(encoding="utf-8") == contract.minimal_json()
