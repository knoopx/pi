---
name: podman
description: "Manages containers, builds images, configures pods and networks with Podman. Use when running containers, creating Containerfiles, grouping services in pods, or managing container resources."
token_cost: 220
keywords:
  ["podman", "container", "image", "pod", "network", "containerfile", "docker"]
---

# Podman

Rootless, daemonless container engine. Commands mirror Docker — substitute `podman` for `docker`.

## Running Containers

```bash
podman run -d --name my-app alpine sleep 1000   # Detached container
podman ps -a                                     # List all containers (including stopped)
podman logs my-app                               # View logs
podman exec my-app ls /app                       # Run command inside container
podman stop my-app && podman rm my-app           # Stop and remove
```

For long-running services, use `-d`. For interactive sessions in headless environments: `tmux new -d 'podman run -it --name my-app alpine sh'`. Use `-f` with `rm`/`rmi`/`prune` to skip prompts.

## Building Images

```bash
podman build -t my-image .          # Reads Containerfile (or Dockerfile)
podman images                       # List local images
podman rmi my-image                 # Remove image
```

Prefer `Containerfile` over `Dockerfile` — it's the OCI convention.

## Pods — Shared Network Namespace

Pods group containers so they communicate over localhost without network configuration:

```bash
podman pod create --name my-stack -p 8080:80
podman run -d --pod my-stack --name web nginx
podman run -d --pod my-stack --name api my-api-image
# web and api share localhost — api reaches nginx at localhost:80
```

## Networking & Secrets

```bash
# Custom network
podman network create my-network
podman run -d --network my-network --name web nginx

# Secrets as environment variables
echo "my-secret" | podman secret create my-secret -
podman run --secret my-secret,type=env,target=MY_SECRET alpine env
```

## Health Checks

```bash
podman run -d \
  --health-cmd "curl -f http://localhost/ || exit 1" \
  --health-interval 30s \
  --name web nginx
podman inspect web --format '{{.State.Health.Status}}'
```

## Compose & Kubernetes

```bash
podman compose up -d                # Docker Compose compatibility
podman generate kube my-pod > pod.yaml  # Generate K8s manifest
podman kube play pod.yaml           # Run K8s manifest
```

## Cleanup

```bash
podman system prune -f              # Remove stopped containers, unused images
podman system df                    # Show disk usage
```

## Constraints

- Rootless by default — binding to ports < 1024 requires subuid/subgid or `--userns=keep-id`
- No background daemon — containers are direct child processes
- Use `Containerfile` as the default build file name
