# Database Configuration (PostgreSQL - Production VPS)

This guide explains how to set up and run a persistent PostgreSQL instance inside an isolated Docker network on your VPS, keeping it secure and hidden from the public internet.

## 1. Create the Isolated Docker Network

To allow your Go API and PostgreSQL containers to communicate securely without exposing database ports to the outside world, create a dedicated bridge network:

```bash
docker network create my_tvtime_network
```

## 2. Run the PostgreSQL Container
Run the following command on your VPS to start the PostgreSQL instance. Your data will be safely stored and persisted inside the `mytvtime_pgdata` Docker volume.

Note: The `-p 5432:5432` option is intentionally omitted to prevent public external access.
```bash
docker run -d \
  --name my_tvtime_db \
  --network my_tvtime_network \
  -v mytvtime_pgdata:/var/lib/postgresql/data \
  -e POSTGRES_USER=your_user_here \
  -e POSTGRES_PASSWORD=your_super_secret_password_here \
  -e POSTGRES_DB=mytvtime_db \
  --restart always \
  postgres:15-alpine
```


