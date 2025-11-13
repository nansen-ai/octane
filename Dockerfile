# Production Dockerfile for Octane
FROM node:14-alpine AS builder

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
FROM node:14-alpine

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
COPY --from=builder /app/packages/server/public ./packages/server/public
COPY --from=builder /app/packages/server/pages ./packages/server/pages
COPY --from=builder /app/packages/server/next.config.js ./packages/server/

# Copy config file
COPY config.json ./

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start production server
WORKDIR /app/packages/server
CMD ["yarn", "start"]

