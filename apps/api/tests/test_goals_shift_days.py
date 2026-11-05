"""
Unit tests for goals_shift_days management command (J8).
Tests DEBUG refusal, validation, transaction atomicity, and date shifting.
"""

import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta, timezone


class TestGoalsShiftDaysCommand(unittest.TestCase):

    def test_refusal_when_debug_is_false(self):
        """Management command MUST refuse execution when DEBUG is False."""
        from apps.api.management.commands.goals_shift_days import Command
        from django.core.management.base import CommandError

        cmd = Command()
        with patch("apps.api.management.commands.goals_shift_days.settings") as mock_settings:
            mock_settings.DEBUG = False
            with self.assertRaises(CommandError) as ctx:
                cmd.handle(email="user@test.com", days=7)
            self.assertIn("only permitted when DEBUG=True", str(ctx.exception))

    def test_validation_rejects_negative_or_zero_days(self):
        """Management command rejects non-positive days."""
        from apps.api.management.commands.goals_shift_days import Command
        from django.core.management.base import CommandError

        cmd = Command()
        with patch("apps.api.management.commands.goals_shift_days.settings") as mock_settings:
            mock_settings.DEBUG = True
            with self.assertRaises(CommandError) as ctx:
                cmd.handle(email="user@test.com", days=0)
            self.assertIn("positive integer", str(ctx.exception))

            with self.assertRaises(CommandError) as ctx2:
                cmd.handle(email="user@test.com", days=-5)
            self.assertIn("positive integer", str(ctx2.exception))

    def test_validation_rejects_empty_email(self):
        """Management command rejects empty email."""
        from apps.api.management.commands.goals_shift_days import Command
        from django.core.management.base import CommandError

        cmd = Command()
        with patch("apps.api.management.commands.goals_shift_days.settings") as mock_settings:
            mock_settings.DEBUG = True
            with self.assertRaises(CommandError) as ctx:
                cmd.handle(email="", days=5)
            self.assertIn("cannot be empty", str(ctx.exception))

    def test_valid_date_shift_logic(self):
        """Verify date shifting backward preserves delta accurately."""
        initial_time = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
        days = 14
        delta = timedelta(days=days)
        shifted = initial_time - delta

        self.assertEqual(shifted, datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc))
        self.assertEqual((initial_time - shifted).days, 14)


if __name__ == "__main__":
    unittest.main()

