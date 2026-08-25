FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/
# Install base (runtime) requirements and production extras. Avoid installing
# dev-only dependencies in the production image to keep image small and
# to ensure hvac (in base.txt) is present in runtime containers.
RUN pip install --no-cache-dir -r requirements/base.txt -r requirements/production.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
