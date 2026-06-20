# DropWave signaling server — tiny Node + ws relay (handshake only, no file data).
# Multi-stage isn't needed; this image is intentionally minimal.
FROM node:20-alpine

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source (single file).
COPY server.js ./

# Fly routes the public 443/80 to this internal port (see fly.toml).
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
