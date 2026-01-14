---
name: podman
description: Manage containers, pods, and images as a daemonless, rootless alternative to Docker.
---

# Podman Skill

Podman is a tool for managing OCI containers and pods. It is daemonless and can run containers as a non-root user.

## Container Management

### Basic Lifecycle

```bash
# Run a container (detached)
podman run -d --name my-app alpine sleep 1000

# List running containers
podman ps

# List all containers (including stopped ones)
podman ps -a

# Stop and remove a container
podman stop my-app
podman rm my-app

# Inspect container details
podman inspect my-app
```

### Logs and Execution

```bash
# View container logs (non-interactive)
podman logs my-app

# Execute a command in a running container
podman exec my-app ls /app
```

## Image Management

```bash
# Pull an image
podman pull alpine:latest

# List local images
podman images

# Build an image from a Containerfile (or Dockerfile)
podman build -t my-custom-image .

# Remove an image
podman rmi my-custom-image
```

## Pods (Unique to Podman)

Pods allow grouping multiple containers together so they share the same network namespace (localhost).

```bash
# Create a pod
podman pod create --name my-stack -p 8080:80

# Run a container inside a pod
podman run -d --pod my-stack --name nginx nginx

# List pods
podman pod ps
```

## Maintenance and Cleanup

```bash
# Remove all stopped containers, unused networks, and dangling images
podman system prune -f

# Show disk usage by containers/images
podman system df
```

## Headless / Non-Interactive Tips

- **Force Flag**: Use `-f` or `--force` with `rm`, `rmi`, and `prune` to avoid confirmation prompts.
- **Detached Mode**: Always use `-d` for long-running services to prevent the command from hanging.
- **Rootless**: Podman runs in rootless mode by default for the current user. Ensure subuid/subgid are configured if running complex workloads.
- **Docker Compatibility**: Most `docker` commands can be prefixed with `podman` instead.

## Volumes

```bash
# Create a volume
podman volume create my-data

# Run container with a volume mount
podman run -v my-data:/data:Z alpine ls /data
```

Note: Use `:Z` or `:z` suffix for volume mounts on systems with SELinux to automatically relabel files.

## Related Skills

- **nix**: Use Nix to create development environments that can be integrated with Podman containers.
