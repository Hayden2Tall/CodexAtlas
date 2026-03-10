#!/usr/bin/env python3
"""
Preprocess ETCBC Dead Sea Scrolls data into Supabase.

Downloads the ETCBC/dss Text-Fabric dataset, extracts Hebrew text per
biblical book and chapter for each scroll, and inserts rows into the
`manuscript_source_texts` table.

Prerequisites:
    pip install text-fabric supabase-py
    Run migration 023 first
    Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment

Usage:
    python scripts/preprocess-dss.py

License: The ETCBC/dss data is MIT-licensed.
"""

import os
import sys

try:
    from tf.app import use
except ImportError:
    print("Install text-fabric: pip install text-fabric")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("Install supabase: pip install supabase")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Map ETCBC scroll names to display names
SCROLL_NAMES = {
    "1QIsaa": "Great Isaiah Scroll (1QIsa-a)",
    "1QIsab": "1QIsa-b",
    "1QpHab": "Habakkuk Commentary (1QpHab)",
    "1QS": "Community Rule (1QS)",
    "1QM": "War Scroll (1QM)",
    "1QH": "Thanksgiving Hymns (1QH)",
    "4QSama": "4QSam-a",
    "4QSamb": "4QSam-b",
    "4QSamc": "4QSam-c",
    "4QJera": "4QJer-a",
    "4QJerb": "4QJer-b",
    "4QJerc": "4QJer-c",
    "4QJerd": "4QJer-d",
    "4QDana": "4QDan-a",
    "4QDanb": "4QDan-b",
    "11QTemple": "Temple Scroll (11QT)",
    "11QPsa": "Great Psalms Scroll (11QPs-a)",
}

# Map ETCBC book names to CodexAtlas display names
BOOK_NAMES = {
    "Genesis": "Genesis", "Exodus": "Exodus", "Leviticus": "Leviticus",
    "Numbers": "Numbers", "Deuteronomy": "Deuteronomy",
    "Joshua": "Joshua", "Judges": "Judges", "Ruth": "Ruth",
    "1_Samuel": "1 Samuel", "2_Samuel": "2 Samuel",
    "1_Kings": "1 Kings", "2_Kings": "2 Kings",
    "Isaiah": "Isaiah", "Jeremiah": "Jeremiah", "Ezekiel": "Ezekiel",
    "Hosea": "Hosea", "Joel": "Joel", "Amos": "Amos",
    "Obadiah": "Obadiah", "Jonah": "Jonah", "Micah": "Micah",
    "Nahum": "Nahum", "Habakkuk": "Habakkuk", "Zephaniah": "Zephaniah",
    "Haggai": "Haggai", "Zechariah": "Zechariah", "Malachi": "Malachi",
    "Psalms": "Psalms", "Proverbs": "Proverbs", "Job": "Job",
    "Song_of_songs": "Song of Solomon", "Ecclesiastes": "Ecclesiastes",
    "Lamentations": "Lamentations", "Daniel": "Daniel",
    "Esther": "Esther", "Ezra": "Ezra", "Nehemiah": "Nehemiah",
    "1_Chronicles": "1 Chronicles", "2_Chronicles": "2 Chronicles",
}


def main():
    print("Loading ETCBC DSS corpus via Text-Fabric...")
    print("(First run will download ~30MB of data)")

    A = use("ETCBC/dss", hoist=globals())
    api = A.api
    F = api.F
    L = api.L
    T = api.T

    print(f"Corpus loaded. Processing scrolls...")

    chapters_data = []
    scroll_count = 0

    for scroll_node in F.otype.s("scroll"):
        scroll_name = T.scrollName(scroll_node) if hasattr(T, "scrollName") else F.scroll.v(scroll_node)
        if not scroll_name:
            continue

        display_name = SCROLL_NAMES.get(scroll_name, scroll_name)
        scroll_count += 1

        # Check if this scroll has biblical content
        for book_node in L.d(scroll_node, "book"):
            book_name_raw = F.book.v(book_node) if hasattr(F.book, "v") else ""
            if not book_name_raw:
                continue

            book_display = BOOK_NAMES.get(book_name_raw, book_name_raw.replace("_", " "))

            for chapter_node in L.d(book_node, "chapter"):
                chapter_num = F.chapter.v(chapter_node) if hasattr(F.chapter, "v") else 0
                if not chapter_num:
                    continue

                # Collect all word text in this chapter
                words = []
                for word_node in L.d(chapter_node, "word"):
                    word_text = T.text(word_node) if hasattr(T, "text") else F.g_cons.v(word_node)
                    if word_text:
                        words.append(word_text.strip())

                if not words:
                    continue

                text = " ".join(words)
                if len(text) < 10:
                    continue

                chapters_data.append({
                    "source": "etcbc_dss",
                    "manuscript_name": display_name,
                    "book": book_display,
                    "chapter": int(chapter_num),
                    "text": text,
                    "metadata": {
                        "scroll_id": scroll_name,
                        "license": "MIT",
                        "corpus": "ETCBC/dss",
                    },
                })

    print(f"Processed {scroll_count} scrolls, extracted {len(chapters_data)} book/chapter sections.")

    if not chapters_data:
        print("No data extracted. The Text-Fabric API may have changed.")
        print("Try running: python -c \"from tf.app import use; A = use('ETCBC/dss')\"")
        sys.exit(1)

    sample = chapters_data[0]
    print(f"Sample: {sample['manuscript_name']} / {sample['book']} {sample['chapter']}")
    print(f"  {sample['text'][:100]}...")

    # Upsert into Supabase in batches
    BATCH_SIZE = 50
    inserted = 0
    errors = 0

    for i in range(0, len(chapters_data), BATCH_SIZE):
        batch = chapters_data[i : i + BATCH_SIZE]
        try:
            supabase.table("manuscript_source_texts").upsert(
                batch,
                on_conflict="source,manuscript_name,book,chapter",
            ).execute()
            inserted += len(batch)
        except Exception as e:
            print(f"Batch {i // BATCH_SIZE + 1} error: {e}")
            errors += 1

    print(f"Done. Inserted/updated {inserted} rows, {errors} batch errors.")


if __name__ == "__main__":
    main()
