"""Curated source set. Recommendations and advisor answers may only cite entries from here
or from the user's own reading list, which keeps the model from inventing titles.

Summaries are deliberately plain and descriptive. Extend this list by hand, not by model.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    id: str
    title: str
    author: str
    tags: tuple[str, ...]
    summary: str
    layer: str  # which protocol layer it mainly serves


CURATED: tuple[Source, ...] = (
    Source("deep_work", "Deep Work", "Cal Newport", ("focus", "attention", "productivity", "habits"),
           "Makes the case for protecting long blocks of undistracted work and shows how to structure them.",
           "daily_os"),
    Source("atomic_habits", "Atomic Habits", "James Clear", ("habits", "systems", "identity", "discipline"),
           "Builds habits from small changes tied to identity and environment design.", "character"),
    Source("war_of_art", "The War of Art", "Steven Pressfield", ("resistance", "creativity", "discipline", "starting"),
           "Names the internal resistance that stops people starting and finishing creative work.", "character"),
    Source("thinking_fast_slow", "Thinking, Fast and Slow", "Daniel Kahneman",
           ("judgement", "decisions", "bias", "psychology"),
           "Explains two modes of thinking and the systematic errors they produce in judgement.", "knowledge"),
    Source("mom_test", "The Mom Test", "Rob Fitzpatrick", ("startup", "customers", "interviews", "validation"),
           "A practical method for learning from customer conversations without being misled by politeness.",
           "mission"),
    Source("lean_startup", "The Lean Startup", "Eric Ries", ("startup", "experiments", "product", "strategy"),
           "Frames building a company as a loop of build, measure and learn with validated learning.", "mission"),
    Source("zero_to_one", "Zero to One", "Peter Thiel", ("startup", "strategy", "monopoly", "innovation"),
           "Argues for building something new rather than competing in an existing market.", "mission"),
    Source("mans_search", "Man's Search for Meaning", "Viktor Frankl", ("meaning", "resilience", "purpose", "legacy"),
           "Frankl's account of finding purpose under extreme hardship and the logotherapy that came from it.",
           "legacy"),
    Source("meditations", "Meditations", "Marcus Aurelius", ("stoicism", "discipline", "character", "reflection"),
           "Private notes on duty, impermanence and acting well, written by a Roman emperor.", "character"),
    Source("range", "Range", "David Epstein", ("generalist", "learning", "careers", "breadth"),
           "Argues that breadth and sampling often beat early specialisation.", "knowledge"),
    Source("essentialism", "Essentialism", "Greg McKeown", ("focus", "prioritisation", "trade-offs", "discipline"),
           "A framework for choosing fewer things and doing them well.", "mission"),
    Source("high_output", "High Output Management", "Andy Grove", ("management", "leverage", "operations", "leadership"),
           "Treats management as a production system and introduces output-based leverage and OKRs.", "mission"),
    Source("pragmatic_programmer", "The Pragmatic Programmer", "Andrew Hunt and David Thomas",
           ("engineering", "craft", "software", "habits"),
           "Practical advice on the craft and habits of professional software development.", "knowledge"),
    Source("ddia", "Designing Data-Intensive Applications", "Martin Kleppmann",
           ("engineering", "systems", "data", "architecture"),
           "A deep guide to the principles behind reliable, scalable data systems.", "knowledge"),
    Source("influence", "Influence", "Robert Cialdini", ("persuasion", "psychology", "presence", "communication"),
           "Describes the psychological principles that drive compliance and persuasion.", "presence"),
    Source("never_split", "Never Split the Difference", "Chris Voss",
           ("negotiation", "communication", "presence", "empathy"),
           "Negotiation tactics from hostage negotiation, built on tactical empathy and calibrated questions.",
           "presence"),
    Source("crucial_conversations", "Crucial Conversations", "Kerry Patterson et al.",
           ("communication", "conflict", "presence", "relationships"),
           "Techniques for staying productive when stakes are high and opinions differ.", "presence"),
    Source("mastery", "Mastery", "Robert Greene", ("mastery", "apprenticeship", "careers", "discipline"),
           "Studies how people reach mastery through apprenticeship, practice and creative breakthroughs.",
           "character"),
    Source("grit", "Grit", "Angela Duckworth", ("perseverance", "passion", "discipline", "character"),
           "Looks at sustained effort toward long-term goals as a predictor of achievement.", "character"),
    Source("mindset", "Mindset", "Carol Dweck", ("learning", "growth", "psychology", "resilience"),
           "Distinguishes fixed and growth mindsets and their effect on learning and effort.", "character"),
    Source("thinking_in_systems", "Thinking in Systems", "Donella Meadows",
           ("systems", "complexity", "leverage", "strategy"),
           "A primer on stocks, flows and feedback loops and where leverage points sit.", "knowledge"),
    Source("impro", "Impro", "Keith Johnstone", ("presence", "spontaneity", "improvisation", "status"),
           "Essays on improvisation, status and spontaneity in performance and social life.", "presence"),
    Source("psychology_money", "The Psychology of Money", "Morgan Housel",
           ("money", "behaviour", "risk", "long-term"),
           "Short essays on how behaviour, more than knowledge, shapes financial outcomes.", "legacy"),
    Source("antifragile", "Antifragile", "Nassim Nicholas Taleb",
           ("risk", "uncertainty", "resilience", "strategy"),
           "Argues for systems that gain from disorder rather than merely resist it.", "knowledge"),
    Source("naval", "The Almanack of Naval Ravikant", "Eric Jorgenson",
           ("wealth", "leverage", "judgement", "happiness"),
           "A compiled collection of Naval Ravikant's thinking on wealth, leverage and happiness.", "mission"),
)

BY_ID = {s.id: s for s in CURATED}
