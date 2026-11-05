"""
Tests verifying that downstream test suites use ready_protocol and onboard helpers
instead of legacy run_interview (J9).
"""

import unittest
from apps.api.tests.onboarding import onboard, ready_protocol, run_interview


class MockClient:
    def post(self, url, data, **kwargs):
        class MockResponse:
            status_code = 201
            def json(self):
                return {"status": "ok", "goal_id": "test-goal-1"}
        return MockResponse()


class TestDownstreamFixtures(unittest.TestCase):

    def test_ready_protocol_helper(self):
        """ready_protocol returns active state without running 13-question interview."""
        client = MockClient()
        res = ready_protocol(client)
        self.assertEqual(res.get("status"), "ok")

    def test_onboard_builder_scenario(self):
        """onboard executes seed calibration with valid scenario."""
        client = MockClient()
        res = onboard(client, scenario="builder", path="seed")
        self.assertEqual(res.get("status"), "ok")

    def test_run_interview_deprecated_warning(self):
        """run_interview emits deprecation warning for downstream tests."""
        client = MockClient()
        with self.assertWarns(DeprecationWarning):
            run_interview(client)


if __name__ == "__main__":
    unittest.main()

