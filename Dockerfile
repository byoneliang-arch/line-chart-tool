FROM node:20-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/data

WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 5001
VOLUME ["/data"]

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "backend.app:app"]
