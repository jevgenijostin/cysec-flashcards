"""Audit the deck with PyMuPDF; never substitute the garbled duplicate layer.

Some pages contain thousands of overlapping/off-page text objects at (0, 0).
Default page extraction excludes that layer. get_texttrace() is used ONLY to
diagnose missing IDs, never to produce study cards from corrupted duplicates.
"""

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz


def normalize(text):
    return unicodedata.normalize("NFKC", text)


def audit(path):
    with fitz.open(path) as document:
        clean = "\n".join(normalize(page.get_text()) for page in document)
        headers = list(re.finditer(r"(?m)^Frage (\d+)\s*$", clean))
        ids = [int(header[1]) for header in headers]
        malformed = []
        for index, header in enumerate(headers):
            end = headers[index + 1].start() if index + 1 < len(headers) else len(clean)
            entry = clean[header.end():end]
            answer = re.search(r"Correct Answer:\s*([ABCD])\s*\(", entry)
            explanation = re.search(r"Explanation:\s*(.+)", entry, re.S)
            option_text = entry[:answer.start()] if answer else entry
            options = re.findall(r"(?<!\S)([ABCD])\.\s+", option_text)
            if not answer or not explanation or options != list("ABCD"):
                malformed.append(int(header[1]))

        # Diagnostic only: this sees even invisible, collapsed duplicate text.
        trace_ids = set()
        for page in document:
            trace = normalize("".join(
                chr(char[0])
                for span in page.get_texttrace()
                for char in span["chars"]
            ))
            trace_ids.update(int(n) for n in re.findall(r"Frage\s*(\d+)", trace))

        expected = set(range(1, 202))
        missing = sorted(expected - set(ids))
        duplicates = sorted(n for n, count in Counter(ids).items() if count > 1)
        unexpected = sorted(set(ids) - expected)
        return {
            "source": path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "pages": len(document),
            "pymupdf_version": fitz.VersionBind,
            "clean_numbered_entries": len(ids),
            "unique_clean_ids": len(set(ids)),
            "missing_clean_ids": missing,
            "duplicate_clean_ids": duplicates,
            "unexpected_clean_ids": unexpected,
            "malformed_clean_ids": malformed,
            "missing_even_in_all_text_traces": sorted(expected - trace_ids),
            "missing_clean_but_present_in_corrupted_layer": sorted(set(missing) & trace_ids),
            "passed": not (missing or duplicates or unexpected or malformed) and len(ids) == 201,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", nargs="?", type=Path, default=Path(__file__).with_name("cysec-cif-karteikarten.pdf"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = audit(args.pdf)
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    print(output, end="")
    raise SystemExit(0 if result["passed"] else 1)
