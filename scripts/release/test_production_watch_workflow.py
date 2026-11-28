"""Keep live-main monitoring separate from pull-request contract checks."""
from pathlib import Path
import subprocess
import unittest

import yaml

WORKFLOW = Path(__file__).resolve().parents[2] / '.github/workflows/production-verification-watch.yml'


class ProductionWatchWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.load(WORKFLOW.read_text(encoding='utf-8'), Loader=yaml.BaseLoader)
        cls.jobs = cls.workflow['jobs']

    def test_candidate_validation_does_not_require_current_main_to_be_green(self):
        self.assertEqual(self.jobs['verify']['if'], "github.event_name != 'pull_request'")
        candidate = self.jobs['validate-candidate']
        self.assertEqual(candidate['if'], "github.event_name == 'pull_request'")
        self.assertNotIn('GH_TOKEN', candidate.get('env', {}))
        self.assertIn('scripts/release/test_production_watch_workflow.py', candidate['steps'][-1]['run'])

    def test_live_monitor_remains_enabled_and_reports_real_failures(self):
        self.assertEqual(self.workflow['on']['schedule'], [{'cron': '7,27,47 * * * *'}])
        self.assertIn('workflow_dispatch', self.workflow['on'])
        steps = {step.get('name'): step for step in self.jobs['verify']['steps']}
        self.assertIn('Snapshot exact-main CI and open PRs', steps)
        self.assertIn('Independently probe anonymous publication', steps)
        self.assertIn('Preserve verification receipt', steps)
        final = steps['Surface confirmed failures without changing code']['run']
        for marker in ('main-workflows.json', 'HTTP_PROBE_FAILED', 'PUBLICATION_VERIFICATION_FAILED', 'exit 1'):
            self.assertIn(marker, final)
        self.assertNotIn('continue-on-error', steps['Surface confirmed failures without changing code'])

    def test_pr_checks_are_triggered_by_changes_to_contract_or_workflow(self):
        paths = self.workflow['on']['pull_request']['paths']
        self.assertIn('.github/workflows/production-verification-watch.yml', paths)
        self.assertIn('scripts/release/test_production_watch_workflow.py', paths)

    def test_inline_shell_programs_parse(self):
        for name, job in self.jobs.items():
            for step in job['steps']:
                if 'run' in step:
                    with self.subTest(job=name, step=step.get('name')):
                        result = subprocess.run(['bash', '-n'], input=step['run'], text=True, capture_output=True)
                        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
