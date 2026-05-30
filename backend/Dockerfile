# Step 1: Use a lightweight Python base image
FROM python:3.11-slim

# Step 2: Establish the working container directory
WORKDIR /app

# Step 3: Install minor toolchains for Postgres bindings / compiling
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Step 4: Copy the pip dependencies declaration list (for efficient layer caching)
COPY requirements.txt .

# Step 5: Install dependencies with no-cache flag to minimize image footprints
RUN pip install --no-cache-dir -r requirements.txt

# Step 6: Clone the rest of the application code
COPY . .

# Step 7: Expose standard container port
EXPOSE 5000

# Step 8: Define runtime variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Step 9: Bind Gunicorn server and configure entrypoint app
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]
