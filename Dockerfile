# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install build dependencies required for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies (using --omit=dev is much more resilient in Docker builds
# than npm ci, preventing build failures due to minor npm version differences)
RUN npm install --omit=dev && npm cache clean --force

# Stage 2: Production stage
FROM node:20-alpine

LABEL maintainer="Hutech Solutions" \
      version="1.0.0" \
      description="Admin Panel Backend Production Image"

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -G nodejs -u 1001 nodejs

# Copy package files first for better caching
COPY package*.json ./

# Copy node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodejs:nodejs . .

# Create necessary directories, fix permissions, and strip Windows CRLF
# from the startup script (critical on Alpine — \r causes "not found" errors)
RUN mkdir -p uploads uploads/resumes uploads/documents && \
    chown -R nodejs:nodejs /usr/src/app && \
    chmod -R 755 /usr/src/app/uploads && \
    chmod +x scripts/docker-start.sh && \
    sed -i 's/\r$//' scripts/docker-start.sh

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 8001

# Health check targeting port 8001 at root route '/'
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8001/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using the startup script
CMD ["sh", "scripts/docker-start.sh"]
