"""Big Five questionnaire (20 items) and scoring. Ported from the legacy assessment screen."""

from typing import Any

TRAITS = ("openness", "conscientiousness", "extraversion", "agreeableness", "stability")

# (id, text, trait, reversed). Neuroticism items score toward "stability" after inversion.
QUESTIONS: list[dict[str, Any]] = [
    {"id": "p1", "text": "I enjoy exploring new ideas and abstract thinking.", "trait": "openness", "reversed": False},
    {"id": "p2", "text": "I prefer routine and familiar activities over novelty.", "trait": "openness", "reversed": True},
    {"id": "p3", "text": "I have a vivid imagination and enjoy creative work.", "trait": "openness", "reversed": False},
    {"id": "p4", "text": "I like to try new approaches rather than following established methods.", "trait": "openness", "reversed": False},
    {"id": "p5", "text": "I always complete tasks thoroughly and on time.", "trait": "conscientiousness", "reversed": False},
    {"id": "p6", "text": "I find it easy to stay organized and plan ahead.", "trait": "conscientiousness", "reversed": False},
    {"id": "p7", "text": "I often procrastinate and leave things to the last minute.", "trait": "conscientiousness", "reversed": True},
    {"id": "p8", "text": "I pay attention to detail and take pride in my work quality.", "trait": "conscientiousness", "reversed": False},
    {"id": "p9", "text": "I set ambitious goals and systematically work toward them.", "trait": "conscientiousness", "reversed": False},
    {"id": "p10", "text": "I feel energized after spending time with people.", "trait": "extraversion", "reversed": False},
    {"id": "p11", "text": "I prefer working alone and find social interaction draining.", "trait": "extraversion", "reversed": True},
    {"id": "p12", "text": "I'm comfortable speaking up in groups and taking leadership.", "trait": "extraversion", "reversed": False},
    {"id": "p13", "text": "I recharge by spending time in solitude and reflection.", "trait": "extraversion", "reversed": True},
    {"id": "p14", "text": "I go out of my way to help others, even at cost to myself.", "trait": "agreeableness", "reversed": False},
    {"id": "p15", "text": "I tend to be competitive rather than cooperative.", "trait": "agreeableness", "reversed": True},
    {"id": "p16", "text": "I trust people's good intentions and give them benefit of the doubt.", "trait": "agreeableness", "reversed": False},
    {"id": "p17", "text": "I can be critical and demanding in my standards for others.", "trait": "agreeableness", "reversed": True},
    {"id": "p18", "text": "I remain calm and stable even under significant pressure.", "trait": "stability", "reversed": False},
    {"id": "p19", "text": "I experience mood swings and emotional ups and downs.", "trait": "stability", "reversed": True},
    {"id": "p20", "text": "I worry often about things that could go wrong.", "trait": "stability", "reversed": True},
]

IDS = {q["id"] for q in QUESTIONS}

DESCRIPTIONS: dict[str, dict[str, str]] = {
    "openness": {
        "name": "Openness",
        "high": "Curious and creative. You tend to thrive on novelty and unconventional approaches.",
        "low": "Practical and focused. You tend to prefer proven methods and concrete goals.",
    },
    "conscientiousness": {
        "name": "Conscientiousness",
        "high": "Organised and goal-driven. Your daily system can lean on structure and accountability.",
        "low": "Flexible and spontaneous. Structure is best added gradually without rigid constraints.",
    },
    "extraversion": {
        "name": "Extraversion",
        "high": "Energised by people. Public work and collaboration will likely suit you.",
        "low": "Energised by solitude. Protect deep work blocks and limit social obligation.",
    },
    "agreeableness": {
        "name": "Agreeableness",
        "high": "Cooperative and empathetic. Goals that serve others will likely motivate you.",
        "low": "Direct and results-focused. You may favour independence and competitive edge.",
    },
    "stability": {
        "name": "Emotional stability",
        "high": "Steady under pressure. Your routine can assume consistency.",
        "low": "More reactive to stress. Build recovery and regulation practices into the day.",
    },
}


def compute_scores(answers: dict[str, int]) -> dict[str, int]:
    """Likert 1..5 to 0..100 per trait. Traits with no answers score 50."""
    buckets: dict[str, list[int]] = {t: [] for t in TRAITS}
    for q in QUESTIONS:
        raw = answers.get(q["id"])
        if raw is None:
            continue
        buckets[q["trait"]].append(6 - raw if q["reversed"] else raw)
    return {
        t: 50 if not vals else round(((sum(vals) / len(vals)) - 1) / 4 * 100)
        for t, vals in buckets.items()
    }
