FROM node:18.20.8-slim

# Install system dependencies for canvas and other native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Set environment
ENV NODE_ENV=production

# Fail fast: validate critical JS files at build time
RUN node -c server.js && node -c dash/index.js && node -c dash/utils/security.js && node -c bot/index.js && node -c bot/utils/auditLogger.js && node -c bot/utils/notificationSender.js && node -c bot/events/auditLogger.js && node -c bot/Commands/Slash/Minecraft/mc-setup.js && echo "All syntax checks passed"

# Railway provides PORT automatically — expose it
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]
