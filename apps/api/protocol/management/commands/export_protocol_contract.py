from django.core.management.base import BaseCommand

from protocol import contract


class Command(BaseCommand):
    help = "Write the protocol JSON Schema and example documents used by the zod mirror."

    def handle(self, *args, **options):
        contract.EXAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
        contract.SCHEMA_PATH.write_text(contract.schema_json(), encoding="utf-8", newline="\n")
        contract.EXAMPLE_PATH.write_text(contract.example_json(), encoding="utf-8", newline="\n")
        contract.MINIMAL_PATH.write_text(contract.minimal_json(), encoding="utf-8", newline="\n")
        self.stdout.write(
            f"Wrote {contract.SCHEMA_PATH.name}, {contract.EXAMPLE_PATH.name} "
            f"and {contract.MINIMAL_PATH.name}"
        )
