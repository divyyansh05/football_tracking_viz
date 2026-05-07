# ── Stage 1: Build the Frontend ───────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Final Backend Image ──────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (required for some analytics libraries like scipy/shapely)
RUN apt-get update && apt-get install -y \
    build-essential \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy the built frontend from Stage 1 into the backend's static directory
# We will tell FastAPI to serve files from here
COPY --from=frontend-builder /app/frontend/dist ./static

# Set environment variables
ENV PORT=8080
ENV DATA_DIR=/app/data

# Run the application
# We use $PORT because Cloud Run provides the port dynamically
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
