"""Extract the 190 real cards. Requires Python 3 and PyMuPDF (pip install PyMuPDF)."""
import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent
# These cards are genuinely absent from this PDF, not extraction failures.
MISSING = {56, 57, 109, 110, 111, 121, 122, 123, 187, 188, 189}
TOPICS = [
    "Надзор CySEC и деятельность CIF", "Работа с клиентами и наилучшее исполнение",
    "ПОД/ФТ и проверка клиентов (AML/CDD)", "Капитал и риски (ICAAP/SREP)",
    "Инвестиционные фонды (UCITS/AIF)", "Злоупотребления на рынке и инсайдерская информация",
    "Восстановление и урегулирование", "Проспекты и прозрачность эмитентов",
    "Клиринг и рыночная инфраструктура", "Банковский надзор и CBC",
]


def topic_for(n):
    # Assign by the subject of the question, not incidental terms in distractors.
    if n == 21 or 63 <= n <= 92:
        return TOPICS[4]
    if n == 5 or 93 <= n <= 100:
        return TOPICS[9]
    if 101 <= n <= 115:
        return TOPICS[2]
    if 127 <= n <= 152:
        return TOPICS[3]
    if 162 <= n <= 175:
        return TOPICS[6]
    if 176 <= n <= 186:
        return TOPICS[7]
    if 187 <= n <= 201:
        return TOPICS[5]
    if n in {9, 16, 22, 23, 24, 28, 31, 32, 34, 36, 37, 38, 39, 61} or 116 <= n <= 126 or 153 <= n <= 161:
        return TOPICS[8]
    if n in {12, 20} or 40 <= n <= 58 or n in {60, 62}:
        return TOPICS[1]
    return TOPICS[0]


def compact(s):
    return re.sub(r"\s+", " ", s).strip()


def extract(pdf):
    with fitz.open(pdf) as doc:
        # Preserve page boundaries: the cards before the four gaps end on their
        # own page. The next page's orphaned fragments belong to missing cards.
        text = "\n\f\n".join(unicodedata.normalize("NFKC", p.get_text()) for p in doc)
    headers = list(re.finditer(r"(?m)^Frage (\d+)\s*$", text))
    cards = []
    for i, h in enumerate(headers):
        n = int(h[1])
        if n in MISSING:
            continue
        body = text[h.end():headers[i + 1].start() if i + 1 < len(headers) else len(text)]
        if n in {55, 108, 120, 186}:
            body = body.split("\f", 1)[0]
        answer = re.search(r"Correct Answer:\s*([ABCD])\s*\((.*?)\)\s*Explanation:", body, re.S)
        if not answer:
            raise ValueError(f"Card {n}: missing answer/explanation")
        front = body[:answer.start()]
        marks = list(re.finditer(r"(?<!\S)([ABCD])\.\s+", front))
        if [m[1] for m in marks] != list("ABCD"):
            raise ValueError(f"Card {n}: expected four options")
        options = [compact(front[m.end():marks[j + 1].start() if j < 3 else len(front)]) for j, m in enumerate(marks)]
        correct = ord(answer[1]) - ord("A")
        if compact(answer[2]) != options[correct]:
            raise ValueError(f"Card {n}: answer text does not match option")
        explanation = "\n\n".join("• " + compact(s) for s in body[answer.end():].split("•") if compact(s))
        question = re.sub(r"^Front:\s*", "", compact(front[:marks[0].start()]))
        if not question or not explanation or not all(options):
            raise ValueError(f"Card {n}: empty field")
        cards.append(dict(id=n, topic=topic_for(n), question=question, options=options, correctIndex=correct, explanation=explanation))
    ids = [c["id"] for c in cards]
    if len(ids) != 190 or set(ids) != set(range(1, 202)) - MISSING:
        raise ValueError("Expected exactly 190 unique source IDs")
    return cards


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", nargs="?", type=Path, default=ROOT / "cysec-cif-karteikarten.pdf")
    parser.add_argument("--output", type=Path, default=ROOT / "data/cards.json")
    args = parser.parse_args()
    cards = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(cards)} cards")
    for topic, count in Counter(c["topic"] for c in cards).items():
        print(f"{topic}: {count}")
