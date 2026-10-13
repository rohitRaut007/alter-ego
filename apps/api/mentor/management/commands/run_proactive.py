from django.core.management.base import BaseCommand

from mentor.proactive import run_for_all_users


class Command(BaseCommand):
    help = "Evaluate proactive mentor rules for every active user (safe to run from cron)."

    def handle(self, *args, **options):
        created = run_for_all_users()
        self.stdout.write(f"Created {created} nudge(s).")
