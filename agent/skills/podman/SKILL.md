---
name: podman
description: "Manages containers, builds images, configures pods and networks with Podman. Use when running containers, creating Containerfiles, grouping services in pods, or managing container resources."
---

# Podman

Rootless, daemonless container engine. Commands mirror Docker — substitute `podman` for `docker`.

## Container Lifecycle

```bash
podman run -d --name my-app alpine sleep 1000   # Run detached
podman ps -a                                     # List all (including stopped)
podman logs my-app                               # View logs
podman exec my-app ls /app                       # Exec command
podman stop my-app && podman rm my-app           # Stop and remove
```

**Non-interactive usage**: Always use `-d` for long-running services. For interactive sessions: `tmux new -d 'podman run -it --name my-app alpine sh'`. Use `-f` with `rm`, `rmi`, `prune` to skip prompts.

## Images

```bash
podman pull alpine:latest
podman build -t my-image .          # Reads Containerfile (or Dockerfile)
podman images                       # List local images
podman rmi my-image                 # Remove
```

## Pods — Shared Network Namespace

Pods group containers so they communicate over localhost (no network config needed between them):

```bash
podman pod create --name my-stack -p 8080:80
podman run -d --pod my-stack --name web nginx
podman run -d --pod my-stack --name api my-api-image
# web and api share localhost — api reaches nginx at localhost:80
podman pod ps
```

## Networking

```bash
podman network create my-network
podman run -d --network my-network --name web nginx
podman network connect my-network existing-container
```

## Secrets

```bash
echo "my-secret-value" | podman secret create my-secret -
podman run --secret my-secret,type=env,target=MY_SECRET alpine env
```

## Health Checks

```bash
podman run -d --health-cmd "curl -f http://localhost/ || exit 1" \
  --health-interval 30s --health-retries 3 --name web nginx
podman inspect web --format '{{.State.Health.Status}}'
```

## Systemd Integration (Quadlet)

Declare containers as systemd units for auto-start and management:

```ini
# ~/.config/containers/systemd/my-app.container
[Container]
Image=nginx:latest
PublishPort=8080:80
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now my-app   # Quadlet auto-generates the service
```

## Compose and Kubernetes

```bash
# Docker Compose compatibility
podman compose up -d
podman compose down

# Generate/play Kubernetes manifests
podman generate kube my-pod > pod.yaml
podman kube play pod.yaml
podman kube down pod.yaml
```

## Cleanup

```bash
podman system prune -f    # Remove stopped containers, unused images, networks
podman system df           # Show disk usage
```

## Constraints

- **Rootless by default**: Runs as current user. Complex workloads (e.g., binding to ports < 1024) require subuid/subgid configuration or `--userns=keep-id`
- **No daemon**: Unlike Docker, podman has no background daemon — containers are managed as direct child processes
- **Containerfile preferred**: Use `Containerfile` (not `Dockerfile`) as the default build file name — podman checks for both but `Containerfile` is the OCI convention
