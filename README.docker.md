# Docker Setup for Octane

This document explains how to run Octane using Docker for both development and production environments.

## Prerequisites

- Docker installed
- `.env` file configured in `packages/server/`
- `config.json` configured at root

## Development

### Build and run development environment:

```bash
# Build development image
docker build -f Dockerfile.dev -t octane:dev .

# Run with volume mounting for hot reload
# Maps container port 3000 to host port 3001
docker run -p 3001:3000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  -v /app/packages/core/node_modules \
  -v /app/packages/server/node_modules \
  --env-file ./packages/server/.env \
  octane:dev
```

**Features:**
- Hot reload enabled
- Source code mounted as volume
- Changes reflect immediately
- Runs on port 3001

### Access the application:
- Main page: http://localhost:3001
- API info: http://localhost:3001/api

## Production

### Build and run production environment:

```bash
# Build production image
docker build -f Dockerfile -t octane:prod .

# Run production container
# Maps container port 3000 to host port 3001
docker run -p 3001:3000 \
  --env-file ./packages/server/.env \
  --restart unless-stopped \
  -d \
  octane:prod
```

**Features:**
- Multi-stage build (smaller image)
- Production dependencies only
- Optimized for performance
- Automatic restarts

## Environment Variables

Make sure your `packages/server/.env` file contains:

```bash
SECRET_KEY=<your_base58_encoded_secret_key>
```

## Configuration

Ensure your `config.json` is properly configured with:
- Token mint addresses
- Token account addresses
- RPC URL
- Return signature settings

## Useful Commands

### List running containers:
```bash
docker ps
```

### Stop containers:
```bash
docker stop <container-id>
```

### View logs:
```bash
docker logs -f <container-id>
```

### Execute commands inside container:
```bash
docker exec -it <container-id> sh
```

### Remove containers:
```bash
docker rm <container-id>
```

### Tag and push to registry (for Kubernetes/Helm):
```bash
# Tag the image
docker tag octane:prod your-registry/octane:latest

# Push to registry
docker push your-registry/octane:latest
```

## Notes

⚠️ **Security Warning:** The `keys/` directory is excluded from Docker images for security. If you need to include keys, mount them as volumes or use Docker secrets.

⚠️ **Environment:** Remember to update your `.env` file with production values when deploying to production.

## Troubleshooting

### Port already in use:
If port 3001 is already in use, change the port mapping:
```bash
docker run -p 3002:3000 ...  # Use port 3002 on host instead
```

**Port Mapping Explained:**
- Container runs on port `3000` internally
- `-p 3001:3000` maps host port `3001` → container port `3000`
- Change the first number to use a different host port

### Module not found errors:
Rebuild the image:
```bash
docker build --no-cache -f Dockerfile -t octane:prod .
```

### Permission issues:
The container runs as the node user. If you encounter permission issues with volumes, adjust ownership:
```bash
sudo chown -R $(id -u):$(id -g) .
```

