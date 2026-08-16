#!/usr/bin/env python3
"""Tests for the voice eval graders.

    python3 -m unittest discover -s scripts/test -p '*_test.py'

The regression class at the bottom is the one that matters. It runs the graders over
the real round-four outputs that are checked into this repository and asserts that
every failure written up in the Field Note is caught. If a threshold drifts until the
harness stops noticing a fabricated arXiv ID, that test goes red.
"""

import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from voiceeval import citations, graders, suite  # noqa: E402
from voiceeval import text as T  # noqa: E402

TODAY = date(2026, 8, 16)
ROUND4 = ROOT / "experiment" / "voice-ft" / "eval" / "results" / "round4_results.json"


def checks_for(task, **overrides):
    item = {"task": task, "checks": overrides}
    return suite.resolve_checks(item)


def failed(findings, check):
    return [f for f in findings if f["check"] == check and f["status"] == "fail"]


def grade(item, output, **overrides):
    item = dict(item)
    task = item.get("task", "Edit")
    resolved = suite.resolve_checks({"task": task, "checks": overrides})
    findings, _ = graders.grade_output(item, output, resolved, resolver=None, today=TODAY)
    return findings


class TextTest(unittest.TestCase):
    def test_longest_common_span_finds_a_pasted_block(self):
        source = "the retry logic was the problem not the network at all"
        pasted = "Here is my critique. " + source
        self.assertEqual(T.longest_common_span(T.tokens(source), T.tokens(pasted)), 11)

    def test_longest_common_span_ignores_scattered_words(self):
        a = T.tokens("the retry logic was the problem")
        b = T.tokens("a problem with logic and retry behaviour")
        self.assertLessEqual(T.longest_common_span(a, b), 2)

    def test_malformed_contraction_catches_the_round_four_typo(self):
        self.assertEqual(T.malformed_contractions("it doesn's matter"), ["doesn's"])

    def test_real_contractions_and_possessives_pass(self):
        clean = "it doesn't matter; Ryan's draft won't ship, they're fine, o'clock"
        self.assertEqual(T.malformed_contractions(clean), [])

    def test_coverage_is_asymmetric(self):
        source = T.content_tokens("latency dropped after the caching layer landed")
        kept = T.content_tokens("The caching layer landed and latency dropped, plus more prose here.")
        self.assertGreater(T.coverage(source, kept), 0.9)
        self.assertLess(T.coverage(source, T.content_tokens("something else entirely")), 0.2)

    def test_wilson_interval_is_wide_at_n_equals_six(self):
        low, high = T.wilson_interval(5, 6)
        self.assertLess(low, 0.5)
        self.assertGreater(high, 0.95)

    def test_wilson_interval_narrows_with_more_samples(self):
        low6, high6 = T.wilson_interval(5, 6)
        low48, high48 = T.wilson_interval(40, 48)
        self.assertLess(high48 - low48, high6 - low6)


class CitationTest(unittest.TestCase):
    def test_the_invented_arxiv_id_fails_offline(self):
        found = citations.extract("see https://arxiv.org/abs/24606.24282 for details")
        self.assertEqual(len(found), 1)
        status, reason = citations.check_format(found[0], today=TODAY)
        self.assertEqual(status, "invalid")
        self.assertIn("YYMM", reason)

    def test_a_real_arxiv_id_passes_format(self):
        found = citations.extract("the preregistered study, arXiv:2510.13939")
        self.assertEqual(citations.check_format(found[0], today=TODAY)[0], "ok")

    def test_an_impossible_month_fails(self):
        found = citations.extract("https://arxiv.org/abs/2599.01234")
        self.assertEqual(citations.check_format(found[0], today=TODAY)[0], "invalid")

    def test_a_future_arxiv_id_fails(self):
        found = citations.extract("https://arxiv.org/abs/2712.00001")
        status, reason = citations.check_format(found[0], today=TODAY)
        self.assertEqual(status, "invalid")
        self.assertIn("2027-12", reason)

    def test_a_malformed_doi_fails_and_a_real_one_passes(self):
        bad = citations.extract("doi:10.1/nope")
        self.assertEqual(bad, [])  # 10.1 is not a DOI prefix, so it is not even a citation
        good = citations.extract("doi:10.1145/3597503.3639180")
        self.assertEqual(citations.check_format(good[0], today=TODAY)[0], "ok")

    def test_example_hosts_are_placeholders_not_inventions(self):
        found = citations.extract("read more at https://example.com/post")
        self.assertEqual(citations.check_format(found[0], today=TODAY)[0], "placeholder")

    def test_audit_without_a_resolver_reports_unverified_rather_than_ok(self):
        audited = citations.audit("https://ryanbaumann.dev/writing/", resolver=None)
        self.assertEqual(audited[0]["verdict"], "unverified")

    def test_trailing_punctuation_is_not_part_of_the_url(self):
        found = citations.extract("see https://ryanbaumann.dev/x.")
        self.assertEqual(found[0]["target"], "https://ryanbaumann.dev/x")


class EditDeltaTest(unittest.TestCase):
    """The check the Field Note said was missing: did the edit change anything."""

    SOURCE = ("Our engineering team has deployed an innovative solution to enhance "
              "system availability.")
    ITEM = {"id": "t", "task": "Edit", "prompt": "Rewrite this.", "source_text": SOURCE}

    def test_the_round_four_non_edit_fails(self):
        # Round four's answer to "rewrite this" was a heading and the input again.
        output = "## The result\n\n" + self.SOURCE
        findings = grade(self.ITEM, output, must_remove=["innovative", "enhance"])
        self.assertTrue(failed(findings, "G-EDIT-DELTA"))
        self.assertTrue(failed(findings, "G-EDIT-TARGET"))

    def test_a_cosmetic_rephrase_still_counts_as_no_edit(self):
        output = "We just shipped an innovative solution to enhance system availability."
        findings = grade(self.ITEM, output, must_remove=["innovative", "enhance"])
        self.assertTrue(failed(findings, "G-EDIT-TARGET"),
                        "the words the brief named are still there")

    def test_a_real_edit_passes(self):
        output = ("We cut unplanned downtime by moving health checks off the request path. "
                  "The API now stays up through a node restart, and nobody gets paged for it.")
        findings = grade(self.ITEM, output, must_remove=["innovative", "enhance"],
                         min_preserve=0.1)
        self.assertFalse(failed(findings, "G-EDIT-DELTA"))
        self.assertFalse(failed(findings, "G-EDIT-TARGET"))

    def test_throwing_the_facts_away_fails_the_other_direction(self):
        item = dict(self.ITEM)
        item["source_text"] = ("The migration cut p95 response time from 840ms to 310ms across "
                               "fourteen services, and saved forty eight thousand dollars a year "
                               "in origin bandwidth charges for the platform group.")
        findings = grade(item, "I shipped a thing and it went fine. Ask me about it sometime.",
                         min_preserve=0.35)
        self.assertTrue(failed(findings, "G-EDIT-PRESERVE"))

    def test_must_remove_words_do_not_count_towards_preservation(self):
        item = {"id": "t", "task": "Edit", "prompt": "x",
                "source_text": "We are pleased to announce our platform."}
        findings = grade(item, "Developers can call the platform API today. Here is the endpoint.",
                         must_remove=["pleased", "announce"], min_preserve=0.5)
        self.assertFalse(failed(findings, "G-EDIT-PRESERVE"))

    def test_a_percent_sign_target_is_matched(self):
        item = {"id": "t", "task": "Edit", "prompt": "x",
                "source_text": "Latency was reduced by 40% during the window."}
        kept = grade(item, "I cut latency 40% during the window by dropping a round trip.",
                     must_preserve=["40%"], min_change=0.0, min_preserve=0.0)
        self.assertFalse(failed(kept, "G-FACT-KEEP"))
        dropped = grade(item, "I made it a lot faster during the window, honestly.",
                        must_preserve=["40%"], min_change=0.0, min_preserve=0.0)
        self.assertTrue(failed(dropped, "G-FACT-KEEP"))

    def test_over_editing_clean_prose_fails_the_restraint_ceiling(self):
        source = ("The gateway was dropping one request in every four hundred, and only under "
                  "load. I found it by replaying a week of traffic against a single instance.")
        item = {"id": "t", "task": "Edit", "prompt": "Light pass.", "source_text": source}
        findings = grade(item, "Everything about this system was broken and I rebuilt all of it "
                               "from scratch over a long weekend with a completely new design.",
                         min_change=None, max_change=0.3, min_preserve=0.75)
        self.assertTrue(failed(findings, "G-EDIT-RESTRAINT"))


class EchoTest(unittest.TestCase):
    def test_a_critique_that_pastes_the_input_back_fails(self):
        source = ("In today's fast-paced digital world, developers face numerous challenges "
                  "with API integrations.")
        item = {"id": "t", "task": "Critique", "prompt": "Critique this.", "source_text": source}
        output = ("This is generic. Here is how I would rewrite it in Ryan's voice:\n\n" + source)
        self.assertTrue(failed(grade(item, output), "G-ECHO"))

    def test_quoting_a_short_phrase_is_allowed(self):
        source = ("In today's fast-paced digital world, developers face numerous challenges "
                  "with API integrations.")
        item = {"id": "t", "task": "Critique", "prompt": "Critique this.", "source_text": source}
        output = ('The opening phrase "in today\'s fast-paced digital world" is filler. '
                  "Start where the integration actually broke, name the endpoint, and say what "
                  "the reader saw in their logs. That gives a reason to keep reading.")
        self.assertFalse(failed(grade(item, output), "G-ECHO"))


class RepetitionTest(unittest.TestCase):
    ITEM = {"id": "t", "task": "Draft", "prompt": "Write something."}

    def test_a_looping_generation_fails(self):
        line = "The model I just shipped still has the same architecture with a smaller vocabulary. "
        self.assertTrue(failed(grade(self.ITEM, line * 4, min_words=None), "G-LOOP"))

    def test_a_repeated_sentence_fails(self):
        output = ("I moved the queue off polling. The write path got faster after that change. "
                  "Then I removed the old worker. The write path got faster after that change.")
        self.assertTrue(failed(grade(self.ITEM, output, min_words=None), "G-DUP-SENTENCE"))

    def test_ordinary_prose_passes(self):
        output = ("I moved the job queue from polling every two seconds to listen and notify. "
                  "Queue depth alarms dropped from thirty a week to two. The change was ninety "
                  "lines. The hard part was that two consumers assumed at-least-once delivery, "
                  "so they had to be made idempotent before any of it could land safely.")
        findings = grade(self.ITEM, output, min_words=None)
        self.assertFalse(failed(findings, "G-LOOP"))
        self.assertFalse(failed(findings, "G-DUP-SENTENCE"))
        self.assertFalse(failed(findings, "G-DISTINCT"))


class HeadlineTest(unittest.TestCase):
    ITEM = {"id": "t", "task": "Headline",
            "prompt": "Generate 8 headline variants for an article on why prompt engineering "
                      "hits an RLHF ceiling."}

    def test_slot_filled_templates_fail(self):
        output = "\n".join([
            "1. why prompt engineering hits an RLHF ceiling: lessons from live traces",
            "2. what happens when prompt engineering hits an RLHF ceiling breaks",
            "3. the architecture behind why prompt engineering hits an RLHF ceiling",
            "4. stop guessing: why prompt engineering hits an RLHF ceiling requires ground truth",
            "5. what shipped: how we solved prompt engineering hits an RLHF ceiling",
            "6. what I learned deploying prompt engineering hits an RLHF ceiling",
        ])
        self.assertTrue(failed(grade(self.ITEM, output), "G-HEADLINE-SLOT"))

    def test_eight_rewordings_of_one_title_fail_variety(self):
        output = "\n".join([
            "1. Why prompt engineering hits a ceiling",
            "2. Why prompt engineering hits a hard ceiling",
            "3. Why prompt engineering hits its ceiling",
            "4. Prompt engineering hits a ceiling, and why",
            "5. Why prompting hits a ceiling",
            "6. Why prompt engineering finally hits a ceiling",
        ])
        self.assertTrue(failed(grade(self.ITEM, output), "G-HEADLINE-VARIETY"))

    def test_genuinely_different_titles_pass(self):
        output = "\n".join([
            "1. The ceiling is in the reward model, not your prompt",
            "2. I spent four months on instructions that could not work",
            "3. Agreeable models write flat prose",
            "4. What a style guide cannot fix",
            "5. Suppress one tell and the model finds another",
            "6. Where prompting stops paying rent",
            "7. Your rubric is downstream of somebody else's preferences",
            "8. Stop tuning the ask; change the weights",
        ])
        findings = grade(self.ITEM, output)
        self.assertFalse(failed(findings, "G-HEADLINE-SLOT"))
        self.assertFalse(failed(findings, "G-HEADLINE-VARIETY"))
        self.assertFalse(failed(findings, "G-HEADLINE-COUNT"))

    def test_too_few_variants_fails(self):
        output = "1. One title\n2. Another title entirely different"
        self.assertTrue(failed(grade(self.ITEM, output), "G-HEADLINE-COUNT"))


class FormTest(unittest.TestCase):
    ITEM = {"id": "t", "task": "Draft", "prompt": "Write something."}

    def test_a_truncated_generation_fails(self):
        output = "The task is a decision, and the grader is a person,"
        self.assertTrue(failed(grade(self.ITEM, output, min_words=None), "G-TRUNCATED"))

    def test_an_unclosed_code_fence_fails(self):
        output = "Run this:\n\n```bash\nnpm run check:content\nIt prints the findings."
        self.assertTrue(failed(grade(self.ITEM, output, min_words=None), "G-TRUNCATED"))

    def test_a_finished_generation_passes(self):
        output = "The grader is a person. That is the whole constraint."
        self.assertFalse(failed(grade(self.ITEM, output, min_words=None), "G-TRUNCATED"))

    def test_length_bounds_are_enforced(self):
        self.assertTrue(failed(grade(self.ITEM, "Too short.", min_words=50), "G-LENGTH"))


class NumberTest(unittest.TestCase):
    ITEM = {"id": "t", "task": "Draft", "prompt": "Write about the onboarding flow."}

    def test_an_invented_percentage_fails(self):
        output = ("I rewrote the onboarding flow. Completion went up 34% in the first week, "
                  "which surprised everyone on the team including me.")
        self.assertTrue(failed(grade(self.ITEM, output, min_words=None), "G-NUMBERS"))

    def test_a_number_from_the_prompt_passes(self):
        item = {"id": "t", "task": "Draft",
                "prompt": "Write about the onboarding flow. Completion went up 34%."}
        output = "Completion went up 34% after I cut the third screen. That is the whole story."
        self.assertFalse(failed(grade(item, output, min_words=None), "G-NUMBERS"))

    def test_an_allowlisted_number_passes(self):
        output = "Queue depth alarms went from 30 a week to 2. That was the entire change."
        findings = grade(self.ITEM, output, min_words=None,
                         allowed_numbers=["30 a week", "2"])
        self.assertFalse(failed(findings, "G-NUMBERS"))


class AbstentionTest(unittest.TestCase):
    ITEM = {"id": "t", "task": "Draft",
            "prompt": "How often do developers abandon an API integration? Cite your sources."}

    def test_inventing_a_source_fails(self):
        output = ("Roughly 60% of integrations are abandoned before the first successful call, "
                  "according to a 2024 survey at https://arxiv.org/abs/2401.99999 which followed "
                  "hundreds of teams through their first month of work with a new API.")
        findings = grade(self.ITEM, output, citation_policy="must_abstain", min_words=None)
        self.assertTrue(failed(findings, "G-ABSTAIN"))

    def test_saying_so_passes(self):
        output = ("I do not have a number for this and I am not going to invent one. What I have "
                  "is my own funnel, which is not the industry. Supply the real figure or cut the "
                  "claim, because a made-up rate is worse than no rate at all here.")
        findings = grade(self.ITEM, output, citation_policy="must_abstain", min_words=None)
        self.assertFalse(failed(findings, "G-ABSTAIN"))

    def test_silence_is_not_abstention(self):
        output = ("Developers abandon integrations all the time. It happens at the auth step "
                  "most often, and it happens quietly, which is what makes it hard to fix.")
        findings = grade(self.ITEM, output, citation_policy="must_abstain", min_words=None)
        self.assertTrue(failed(findings, "G-ABSTAIN"))


class ScaffoldTest(unittest.TestCase):
    def test_a_leaked_task_tag_fails(self):
        item = {"id": "t", "task": "Draft", "prompt": "Write something."}
        findings = grade(item, "[Task: Draft]\nHere is the note you asked for, in full.",
                         min_words=None)
        self.assertTrue(failed(findings, "G-SCAFFOLD"))


class SuiteTest(unittest.TestCase):
    def setUp(self):
        self.items = suite.load_suite()

    def test_the_suite_is_big_enough_to_say_something(self):
        self.assertGreaterEqual(len(self.items), 40)

    def test_every_task_has_coverage(self):
        counts = suite.coverage_report(self.items)
        for task in suite.TASKS:
            self.assertGreaterEqual(counts.get(task, 0), 5, "%s is thin: %s" % (task, counts))

    def test_every_item_states_why_it_exists(self):
        missing = [i["id"] for i in self.items if not i.get("why")]
        self.assertEqual(missing, [], "items with no rationale: %s" % missing)

    def test_edit_items_carry_the_text_they_are_editing(self):
        for item in self.items:
            if item["task"] == "Edit":
                self.assertTrue(item.get("source_text"),
                                "%s is an Edit with no source_text, so the delta check "
                                "cannot run" % item["id"])

    def test_checks_resolve_for_every_item(self):
        for item in self.items:
            resolved = suite.resolve_checks(item)
            self.assertIn("max_echo_tokens", resolved)

    def test_the_suite_does_not_overlap_the_training_data(self):
        findings = [f for f in suite.check_leakage(self.items) if f["severity"] == "error"]
        self.assertEqual(findings, [], "held-out prompts share phrasing with training data")


class Round4RegressionTest(unittest.TestCase):
    """The graders, run over the real artifacts the Field Note describes."""

    EXPECTED = {
        "eval_02": ["G-HYPE"],                      # the edit that did not edit
        "eval_03": ["G-ECHO", "G-AI-TELLS"],        # critique pasted its input back
        "eval_04": ["G-HEADLINE-SLOT"],             # topic string in a title frame
        "eval_05": ["G-LOOP", "G-TYPO"],            # looping draft, "doesn's"
        "eval_06": ["G-CITATION", "G-LOOP"],        # arxiv.org/abs/24606.24282
    }

    @classmethod
    def setUpClass(cls):
        if not ROUND4.exists():
            raise unittest.SkipTest("round4_results.json is not checked in")
        with open(str(ROUND4), "r", encoding="utf-8") as handle:
            records = json.load(handle)
        legacy = {i["id"]: i for i in suite.load_suite(
            ROOT / "experiment" / "voice-ft" / "eval" / "prompts.jsonl")}
        cls.graded = {}
        for record in records:
            item = legacy.get(record["id"], {"id": record["id"], "task": record["task"],
                                             "prompt": record.get("prompt", "")})
            resolved = suite.resolve_checks(item)
            findings, _ = graders.grade_output(item, record["output"], resolved,
                                               resolver=None, today=TODAY)
            cls.graded[record["id"]] = findings

    def test_each_documented_failure_is_caught(self):
        for item_id, expected in self.EXPECTED.items():
            findings = self.graded[item_id]
            for check in expected:
                self.assertTrue(failed(findings, check),
                                "%s should fail %s and does not" % (item_id, check))

    def test_the_invented_arxiv_id_is_caught_with_no_network(self):
        message = failed(self.graded["eval_06"], "G-CITATION")[0]["message"]
        self.assertIn("24606.24282", message)

    def test_the_one_passing_item_still_passes(self):
        errors = [f for f in self.graded["eval_01"]
                  if f["status"] == "fail" and f["severity"] == "error"]
        self.assertEqual(errors, [], "eval_01 was the clean one: %s" % errors)

    def test_five_of_six_fail_which_is_what_the_note_claims(self):
        failing = [i for i, findings in self.graded.items()
                   if [f for f in findings if f["status"] == "fail" and f["severity"] == "error"]]
        self.assertEqual(len(failing), 5, "expected five failures, got %s" % sorted(failing))


if __name__ == "__main__":
    unittest.main(verbosity=2)
