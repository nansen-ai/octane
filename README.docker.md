# Docker Setup for Octane

This Docker setup is for **production deployments only** (Kubernetes, cloud hosting, etc.).

**For local development**, run Octane directly without Docker:
```bash
yarn install
yarn build
yarn dev
# Access at http://localhost:3001
```

## Prerequisites

- Docker installed
- `.env` file configured in `packages/server/`
- `config.json` configured at root

## Production Build & Deploy

### Build production image:

```bash
docker build -t octane:prod .
```

### Run locally (testing):

```bash
# Maps container port 3000 to host port 3001
docker run -p 3001:3000 \
  --env-file ./packages/server/.env \
  --restart unless-stopped \
  -d \
  octane:prod
```

### Tag and push to registry (for Kubernetes):

```bash
# Tag with your registry
docker tag octane:prod your-registry.io/octane:latest
docker tag octane:prod your-registry.io/octane:0.1.0

# Push to registry
docker push your-registry.io/octane:latest
docker push your-registry.io/octane:0.1.0
```

**Image Features:**
- Multi-stage build (optimized size ~400MB)
- Production dependencies only
- Security hardened
- Ready for Kubernetes/Helm

## Access the application:
- Main page: http://localhost:3001
- API info: http://localhost:3001/api

## Environment Variables

Your `packages/server/.env` file must contain:

```bash
SECRET_KEY=<your_base58_encoded_secret_key>
```

For Kubernetes deployments, these will be injected via Helm values/secrets (see Helm chart documentation).

## Configuration

Ensure your `config.json` is properly configured with:
- Token mint addresses
- Token account addresses  
- RPC URL
- Return signature settings

The `config.json` is baked into the Docker image during build.

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

### Clean up images:
```bash
# Remove unused images
docker image prune

# Remove specific image
docker rmi octane:prod
```

## Important Notes

⚠️ **Security:** The `keys/` directory is excluded from Docker images. For Kubernetes, use Helm to inject the `SECRET_KEY` via secrets.

⚠️ **Environment:** Never commit `.env` files. Use Kubernetes secrets or Helm values for production deployments.

⚠️ **Config:** The `config.json` is baked into the image. Update it before building for different environments.

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

