# Production Dockerfile for Octane
FROM node:20-alpine AS builder

# Install Python and build tools for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock lerna.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock lerna.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/server/.next ./packages/server/.next
COPY --from=builder /app/packages/server/pages ./packages/server/pages
COPY --from=builder /app/packages/server/next.config.js ./packages/server/
COPY --from=builder /app/packages/server/src ./packages/server/src

# Copy config file
COPY config.json ./

# ====== ADD THIS SECTION ======
# Copy custom entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
# ==============================

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Set working directory for startup
WORKDIR /app/packages/server

# Start production server
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["yarn", "start"]

