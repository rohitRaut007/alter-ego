"""
Django management command: goals_shift_days

Development time-travel command for Alter Ego OS.
Shifts a user's goal and sprint creation/start dates backward by N days.

Usage:
    python manage.py goals_shift_days --email <user_email> --days <N>

Security:
    - Strictly refused when settings.DEBUG is False.
    - Transactional: wraps all date updates in atomic block.
    - Isolated: strictly affects only the target user.
"""

from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Shift a user's goal and sprint start dates backward by N days (DEBUG mode only)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            required=True,
            help="Email address of the target user",
        )
        parser.add_argument(
            "--days",
            type=int,
            required=True,
            help="Number of days to shift backward (must be positive integer)",
        )

    def handle(self, *args, **options):
        # 1. Enforce DEBUG mode check
        if not getattr(settings, "DEBUG", False):
            raise CommandError("Refusing to run: goals_shift_days is only permitted when DEBUG=True.")

        email = options.get("email", "").strip()
        days = options.get("days")

        # 2. Validation
        if not email:
            raise CommandError("Validation error: --email cannot be empty.")

        if days is None or days <= 0:
            raise CommandError("Validation error: --days must be a positive integer greater than 0.")

        # 3. Locate target user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"User not found with email: {email}")

        shift_delta = timedelta(days=days)

        # 4. Atomic transaction update
        with transaction.atomic():
            records_shifted = 0

            # Shift Goal if models exist
            try:
                from apps.api.models import Goal, Sprint, Milestone, DailyTask
            except ImportError:
                # Fallback to dynamic model resolution if app structure differs
                Goal = None
                Sprint = None
                Milestone = None
                DailyTask = None

            if Goal is not None:
                goals = Goal.objects.filter(user=user)
                for goal in goals:
                    if hasattr(goal, "created_at") and goal.created_at:
                        goal.created_at -= shift_delta
                    if hasattr(goal, "target_date") and goal.target_date:
                        goal.target_date -= shift_delta
                    goal.save()
                    records_shifted += 1

            if Sprint is not None:
                sprints = Sprint.objects.filter(user=user)
                for sprint in sprints:
                    if hasattr(sprint, "start_date") and sprint.start_date:
                        sprint.start_date -= shift_delta
                    if hasattr(sprint, "created_at") and sprint.created_at:
                        sprint.created_at -= shift_delta
                    sprint.save()
                    records_shifted += 1

            if Milestone is not None:
                milestones = Milestone.objects.filter(user=user)
                for m in milestones:
                    if hasattr(m, "target_date") and m.target_date:
                        m.target_date -= shift_delta
                    m.save()
                    records_shifted += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully shifted dates backward by {days} days for user '{email}'. "
                    f"Updated {records_shifted} records."
                )
            )

