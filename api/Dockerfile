FROM python:3.12-slim

WORKDIR /app

COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api/ /app/api/
COPY docs/skimmer-semantic-layer.yaml /app/docs/skimmer-semantic-layer.yaml

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
