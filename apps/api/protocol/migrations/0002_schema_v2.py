"""Protocol schema 2.0.0 (ADR 0010). Stored 1.0.0 sections are valid 2.0.0 sections unchanged,
so only the recorded version moves."""

from django.db import migrations


def forwards(apps, schema_editor):
    Protocol = apps.get_model("protocol", "Protocol")
    Protocol.objects.filter(schema_version="1.0.0").update(schema_version="2.0.0")


def backwards(apps, schema_editor):
    # 2.0.0 protocols built from cards may lack sections, so they cannot be relabelled 1.0.0.
    Protocol = apps.get_model("protocol", "Protocol")
    Protocol.objects.filter(schema_version="2.0.0", interview__isnull=False).update(
        schema_version="1.0.0"
    )


class Migration(migrations.Migration):
    dependencies = [("protocol", "0001_initial")]

    operations = [migrations.RunPython(forwards, backwards)]
