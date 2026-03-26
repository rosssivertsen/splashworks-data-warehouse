FROM python:3.12-slim

WORKDIR /app

COPY ripple/api/requirements.txt /app/ripple/api/requirements.txt
RUN pip install --no-cache-dir -r /app/ripple/api/requirements.txt

COPY ripple/api/ /app/ripple/api/
COPY ripple/cli/ /app/ripple/cli/
COPY ripple/config/ /app/ripple/config/
COPY api/__init__.py /app/api/__init__.py
COPY api/middleware/ /app/api/middleware/
COPY docs/ /app/docs/

CMD ["uvicorn", "ripple.api.main:app", "--host", "0.0.0.0", "--port", "8082"]
