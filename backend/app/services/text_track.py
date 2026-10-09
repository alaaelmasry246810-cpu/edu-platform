"""Text track for the "lesson text" view of an interactive video: the lesson's
own sentences, each with the time the teacher says it, so the player can light
up the sentence being spoken.

For podcasts / uploaded videos the times come from aligning the lesson text to
the Whisper transcript. When the recording doesn't follow the lesson text
closely enough, the teacher's own transcribed sentences are used instead.
(AI videos don't need this: the player times each scene's narration itself.)
"""
import re

_DIACRITICS = re.compile(r"[ً-ْٰـ]")
_SENTENCE_END = re.compile(r"(?<=[.!?؟؛])\s+|\n+")
_MIN_MATCH = 0.3        # word-overlap (Dice) score for a segment to count as saying a sentence
_SKIP_PENALTY = 0.08    # per sentence skipped ahead of the current position
_MIN_COVERAGE = 0.35    # share of lesson sentences matched to trust the lesson text


def _normalize(word: str) -> str:
    w = _DIACRITICS.sub("", word.lower())
    w = re.sub("[إأآا]", "ا", w)
    w = w.replace("ى", "ي").replace("ة", "ه")
    w = re.sub(r"^(وال|بال|كال|فال|لل|ال)", "", w)  # Arabic article/prefix
    return re.sub(r"[^\w]", "", w)


def _tokens(text: str) -> set[str]:
    return {t for t in (_normalize(w) for w in text.split()) if len(t) > 1}


def split_sentences(text: str, max_len: int = 220) -> list[str]:
    out = []
    for part in _SENTENCE_END.split(text or ""):
        part = re.sub(r"\s+", " ", part).strip()
        if not part or part.startswith("## "):
            continue
        # Break very long sentences at commas so the highlight keeps moving.
        while len(part) > max_len:
            cut = max(part.rfind("،", 0, max_len), part.rfind(",", 0, max_len))
            if cut < max_len // 3:
                cut = part.rfind(" ", 0, max_len)
            if cut <= 0:
                break
            out.append(part[: cut + 1].strip())
            part = part[cut + 1:].strip()
        if part:
            out.append(part)
    return out


def _align(sentences: list[str], segments: list[dict]) -> list[dict] | None:
    sent_tokens = [_tokens(s) for s in sentences]
    starts: list[float | None] = [None] * len(sentences)
    ends: list[float | None] = [None] * len(sentences)
    cursor = 0
    for seg in segments:
        seg_tokens = _tokens(seg["text"])
        if not seg_tokens:
            continue
        best, best_score = None, 0.0
        # Monotonic: the teacher moves forward through the text and may skip a
        # few sentences, but each skipped sentence costs a little so a short
        # sentence further on can't steal a segment that only shares a few words.
        for k in range(cursor, min(cursor + 6, len(sentences))):
            if not sent_tokens[k]:
                continue
            common = len(sent_tokens[k] & seg_tokens)
            score = 2 * common / (len(sent_tokens[k]) + len(seg_tokens)) - _SKIP_PENALTY * (k - cursor)
            if score > best_score:
                best, best_score = k, score
        if best is not None and best_score >= _MIN_MATCH:
            starts[best] = seg["start"] if starts[best] is None else min(starts[best], seg["start"])
            ends[best] = max(ends[best] or 0, seg["end"])
            cursor = best

    matched = sum(s is not None for s in starts)
    if not sentences or matched / len(sentences) < _MIN_COVERAGE:
        return None

    # Runs of unmatched sentences share the gap between their matched
    # neighbours, split by sentence length.
    total_end = segments[-1]["end"] if segments else 0
    i = 0
    while i < len(sentences):
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < len(sentences) and starts[j] is None:
            j += 1
        gap_start = ends[i - 1] if i > 0 else 0.0
        gap_end = starts[j] if j < len(sentences) else total_end
        gap_end = max(gap_start, gap_end)
        lengths = [max(1, len(sentences[k])) for k in range(i, j)]
        t = gap_start
        for k, n in zip(range(i, j), lengths):
            starts[k] = t
            t += (gap_end - gap_start) * n / sum(lengths)
            ends[k] = t
        i = j
    return [
        {"text": text, "start": round(starts[k], 2), "end": round(ends[k], 2)}
        for k, text in enumerate(sentences)
    ]


def build_text_track(lesson_text: str | None, segments: list[dict]) -> dict:
    """{"source": "lesson" | "transcript", "sentences": [{text, start, end}]}"""
    if lesson_text:
        aligned = _align(split_sentences(lesson_text), segments)
        if aligned:
            return {"source": "lesson", "sentences": aligned}
    return {
        "source": "transcript",
        "sentences": [{"text": s["text"], "start": round(s["start"], 2), "end": round(s["end"], 2)} for s in segments if s["text"]],
    }
