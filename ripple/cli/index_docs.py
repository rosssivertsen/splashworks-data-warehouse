"""
Ripple Corpus Indexer
Reads the corpus manifest, chunks documents, embeds with OpenAI, upserts to pgvector.
Incremental: only re-embeds chunks whose content has changed (checksum-based).

Usage:
    python -m ripple.cli.index_docs
    python -m ripple.cli.index_docs --force   # re-index everything
"""

import argparse
import glob
import hashlib
import os
import re
import sys

import yaml

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from ripple.api.db import ensure_schema, get_connection
from ripple.api.services.embeddings import embed_texts

MANIFEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config",
    "corpus-manifest.yaml",
)

# Project root (splashworks-data-warehouse/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_manifest() -> list[str]:
    """Load and resolve glob patterns from the corpus manifest."""
    with open(MANIFEST_PATH) as f:
        manifest = yaml.safe_load(f)

    files = []
    for pattern in manifest["sources"]:
        full_pattern = os.path.join(PROJECT_ROOT, pattern)
        matched = glob.glob(full_pattern, recursive=True)
        files.extend(matched)

    # Deduplicate and sort
    return sorted(set(files))


def classify_doc(filepath: str) -> tuple[str, str | None]:
    """Determine doc_type and entity from filepath."""
    rel = os.path.relpath(filepath, PROJECT_ROOT)

    if "enterprise/customer" in rel:
        return "glossary", "customer"
    if "enterprise/contact" in rel:
        return "glossary", "contact"
    if "enterprise/service-location" in rel:
        return "glossary", "service_location"
    if "enterprise/pool" in rel:
        return "glossary", "pool"
    if "enterprise/naming" in rel:
        return "standard", None
    if "enterprise/system-landscape" in rel:
        return "reference", None
    if "enterprise/qbo" in rel:
        return "reference", None
    if "semantic-layer" in rel:
        return "semantic", None
    if "DATA_DICTIONARY" in rel:
        return "dictionary", None
    if "ERD" in rel:
        return "erd", None
    return "general", None


def chunk_markdown(content: str, max_tokens: int = 500) -> list[dict]:
    """Split markdown by ## headings. Each chunk includes heading context."""
    chunks = []
    # Split on ## headings (keep the heading with the chunk)
    sections = re.split(r"(?=^## )", content, flags=re.MULTILINE)

    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Extract heading if present
        heading = None
        lines = section.split("\n")
        if lines[0].startswith("## "):
            heading = lines[0].lstrip("# ").strip()

        # If the section is very long, split further on ### headings
        if len(section.split()) > max_tokens:
            subsections = re.split(r"(?=^### )", section, flags=re.MULTILINE)
            for sub in subsections:
                sub = sub.strip()
                if not sub:
                    continue
                sub_lines = sub.split("\n")
                sub_heading = heading
                if sub_lines[0].startswith("### "):
                    sub_heading = sub_lines[0].lstrip("# ").strip()
                chunks.append({"heading": sub_heading, "content": sub})
        else:
            chunks.append({"heading": heading, "content": section})

    return chunks


def chunk_yaml(content: str) -> list[dict]:
    """Split YAML by top-level keys, then by list entries if large."""
    chunks = []
    data = yaml.safe_load(content)

    if not isinstance(data, dict):
        chunks.append({"heading": None, "content": content})
        return chunks

    for key, value in data.items():
        section_text = yaml.dump({key: value}, default_flow_style=False, allow_unicode=True)

        if isinstance(value, list) and len(section_text.split()) > 300:
            # Split large lists into individual entries
            for i, item in enumerate(value):
                entry_text = yaml.dump(item, default_flow_style=False, allow_unicode=True)
                entry_name = None
                if isinstance(item, dict):
                    entry_name = item.get("name") or item.get("term") or item.get("table")
                heading = f"{key} > {entry_name}" if entry_name else f"{key}[{i}]"
                chunks.append({"heading": heading, "content": entry_text})
        else:
            chunks.append({"heading": key, "content": section_text})

    return chunks


def chunk_file(filepath: str) -> list[dict]:
    """Chunk a file based on its type."""
    with open(filepath) as f:
        content = f.read()

    if filepath.endswith((".yaml", ".yml")):
        return chunk_yaml(content)
    else:
        return chunk_markdown(content)


def md5(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def index_all(force: bool = False):
    """Main indexing function."""
    ensure_schema()
    files = load_manifest()

    if not files:
        print("No files matched the corpus manifest.")
        return

    print(f"Found {len(files)} files in corpus manifest")

    conn = get_connection()
    try:
        # Load existing checksums
        existing: dict[tuple[str, int], str] = {}
        if not force:
            with conn.cursor() as cur:
                cur.execute("SELECT source_file, chunk_index, checksum FROM ripple.doc_chunks")
                for row in cur.fetchall():
                    existing[(row[0], row[1])] = row[2]

        all_chunks = []
        for filepath in files:
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            doc_type, entity = classify_doc(filepath)
            file_chunks = chunk_file(filepath)

            for i, chunk in enumerate(file_chunks):
                checksum = md5(chunk["content"])
                key = (rel_path, i)

                # Skip if unchanged
                if not force and key in existing and existing[key] == checksum:
                    continue

                all_chunks.append(
                    {
                        "source_file": rel_path,
                        "chunk_index": i,
                        "heading": chunk["heading"],
                        "content": chunk["content"],
                        "checksum": checksum,
                        "doc_type": doc_type,
                        "entity": entity,
                    }
                )

        if not all_chunks:
            print("All chunks up to date. Nothing to index.")
            return

        print(f"Embedding {len(all_chunks)} chunks...")

        # Batch embed (OpenAI supports up to 2048 per call)
        batch_size = 100
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i : i + batch_size]
            texts = [c["content"] for c in batch]
            embeddings = embed_texts(texts)

            with conn.cursor() as cur:
                for chunk, embedding in zip(batch, embeddings):
                    cur.execute(
                        """
                        INSERT INTO ripple.doc_chunks
                            (source_file, chunk_index, heading, content, embedding, doc_type, entity, checksum, indexed_at)
                        VALUES (%s, %s, %s, %s, %s::vector, %s, %s, %s, NOW())
                        ON CONFLICT (source_file, chunk_index)
                        DO UPDATE SET
                            heading = EXCLUDED.heading,
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            doc_type = EXCLUDED.doc_type,
                            entity = EXCLUDED.entity,
                            checksum = EXCLUDED.checksum,
                            indexed_at = NOW()
                        """,
                        (
                            chunk["source_file"],
                            chunk["chunk_index"],
                            chunk["heading"],
                            chunk["content"],
                            embedding,
                            chunk["doc_type"],
                            chunk["entity"],
                            chunk["checksum"],
                        ),
                    )
            conn.commit()
            print(f"  Indexed batch {i // batch_size + 1} ({len(batch)} chunks)")

        # Clean up chunks from files no longer in manifest
        current_files = {os.path.relpath(f, PROJECT_ROOT) for f in files}
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_file FROM ripple.doc_chunks")
            indexed_files = {row[0] for row in cur.fetchall()}
            stale_files = indexed_files - current_files
            if stale_files:
                for sf in stale_files:
                    cur.execute("DELETE FROM ripple.doc_chunks WHERE source_file = %s", (sf,))
                    print(f"  Removed stale file: {sf}")
                conn.commit()

        # Final stats
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT source_file), COUNT(*) FROM ripple.doc_chunks")
            total_files, total_chunks = cur.fetchone()
        print(f"\nDone. {total_files} files, {total_chunks} chunks indexed.")

    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Index Ripple RAG corpus")
    parser.add_argument("--force", action="store_true", help="Re-index all chunks")
    args = parser.parse_args()
    index_all(force=args.force)
