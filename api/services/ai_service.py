import re

import anthropic

from api.config import ANTHROPIC_API_KEY


def extract_sql_from_response(text: str) -> str | None:
    """Extract SQL from Claude's response.

    Looks for ```sql ... ``` blocks first, then falls back to
    detecting a bare SELECT/WITH statement.
    """
    if not text or not text.strip():
        return None

    # Try to find SQL in markdown code block
    match = re.search(r'```(?:sql)?\s*\n?(.*?)```', text, re.DOTALL)
    if match:
        sql = match.group(1).strip()
        if sql:
            return sql

    # Fallback: look for a line starting with SELECT or WITH
    for line in text.split("\n"):
        stripped = line.strip()
        if re.match(r'^(SELECT|WITH)\b', stripped, re.IGNORECASE):
            idx = text.index(line)
            candidate = text[idx:].strip()
            lines = []
            for l in candidate.split("\n"):
                if not l.strip() and lines:
                    break
                lines.append(l)
            return "\n".join(lines).strip()

    return None


def generate_sql(question: str, system_prompt: str, technical_instructions: str | None = None) -> tuple[str | None, str]:
    """Call Claude to generate SQL from a natural language question.

    Returns (sql, full_response_text).
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # If the rewriter provided instructions, prepend them to the question
    user_content = question
    if technical_instructions:
        user_content = f"{question}\n\n## Technical Instructions (from query preprocessor)\n{technical_instructions}"

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_content},
        ],
    )

    response_text = message.content[0].text
    sql = extract_sql_from_response(response_text)
    return sql, response_text
