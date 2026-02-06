FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies for native modules (canvas)
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config files
COPY src/ ./src/
COPY rollup.config.mjs tsconfig.json ./
COPY styles.css ./

# Add node_modules/.bin to PATH
ENV PATH="/app/node_modules/.bin:$PATH"

# Default command: build the plugin
CMD ["npm", "run", "build"]
