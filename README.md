# CySEC / CIF Flashcards

A mobile study app: pick a topic, cards come in random order, check your answer and
read the explanation. A wrong answer sends the card to the back of the queue; a
correct one removes it from the session. After finishing you can repeat the same
topic in a new order or pick another. Progress is kept only for the current session.

**Open:** https://jevgenijostin.github.io/cysec-flashcards/

Interface, topic names, questions, options and explanations are all in English (the
questions/explanations are verbatim from the source PDF). The app does not revise the
content of the source material. Plain HTML, CSS and JavaScript - no build step, no
external dependencies, no CDN, no downloaded fonts.

## Coverage

**190 of 201** cards are included. The source PDF is genuinely missing
**56, 57, 109, 110, 111, 121, 122, 123, 187, 188, 189** - this is a defect in the
source itself, not an extraction error. Numbering is preserved: `id` matches the
original `Frage` number. Orphaned explanation fragments from the missing cards are
excluded.

| Topic | Cards |
| --- | ---: |
| CySEC Supervision & CIF Operations | 23 |
| Client Conduct & Best Execution | 21 |
| AML/CFT & Customer Due Diligence | 12 |
| Capital & Risk (ICAAP/SREP) | 26 |
| Investment Funds (UCITS/AIF) | 31 |
| Market Abuse & Inside Information | 12 |
| Recovery & Resolution | 14 |
| Prospectus & Issuer Transparency | 11 |
| Clearing & Market Infrastructure | 31 |
| Banking Supervision & CBC | 9 |

## Running locally

From the repo root: `python -m http.server 8000`, then open
http://localhost:8000. An HTTP server is required because the app loads the JSON via
`fetch`; opening `index.html` as `file://` won't work. Python is only needed for the
local server and extraction - GitHub Pages just serves plain static files.

## Updating the cards

The app's data source is `data/cards.json`, an array of objects:

```json
{
  "id": 56,
  "topic": "Client Conduct & Best Execution",
  "question": "Exact question text from the recovered source",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Exact explanation from the source"
}
```

This is an example of the shape, not a recovered card. `correctIndex` is the 0-3
index (A-D); `id` must be a unique positive integer. There must be exactly four
options. Pick the topic by the question's actual subject, not by words that appear
in a wrong answer; use one of the existing topic names exactly. The current PDF's
assignment logic lives in `topic_for` in `extract_cards.py`.

Once the full source is found, **just append** objects with `id`
**56, 57, 109-111, 121-123, 187-189** to the array, filled in with the real
questions, options and explanations. Expected topics: 56-57 - client conduct;
109-111 - AML/CDD; 121-123 - market infrastructure; 187-189 - market abuse. Confirm
the topic against the actual content of whatever card you recover. Object order
doesn't matter, and don't renumber the existing cards. **No code changes are
needed** - topics, counts and the queue are all built from the JSON automatically.
Update the table and the coverage note above in this README.

To re-run extraction against this same incomplete PDF:

```sh
python -m pip install PyMuPDF
python extract_cards.py
```

The script verifies the 190 real numbers, four options, and that the correct answer
matches. Known-missing numbers are skipped; fragments straddling a page boundary are
dropped. It overwrites the JSON - after manually adding recovered cards, use
`--output extracted-cards.json` to diff against them instead of losing the
additions. For a different PDF the boundary rules would need revisiting.

`audit_pdf.py` and `extraction-audit.json` are historical diagnostics of the
source; the audit requires all 201 cards and so returns exit code 1 for this PDF.
That's not a readiness check for the app. The actual resolution is documented in
EXTRACTION_REPORT.md.

## Publishing and checks

GitHub Pages: `main` branch, root `/`. Changes publish via a direct push to `main`.
After editing the JSON, check the app locally and run:

```sh
git add .
git commit -m "Update flashcards"
git push origin main
```

For a browser check (dev-only): `pip install playwright`,
`python -m playwright install chromium`, start the local server, then run
`python test_app.py`. It exercises all 190 cards, the wrong-answer requeue,
completion, repeat, topic selection, mobile width and the load-error state.
