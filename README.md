# Service Alex Test

A Symfony 6 microservice with MongoDB, Redis, and RabbitMQ integration.

## Stack Overview

This microservice is built with the following technologies:

- **PHP 8.2** with FPM for request handling
- **Symfony 6.4** as the application framework
- **MongoDB 7.0** for document storage using Doctrine ODM
- **Redis 7.2** for caching and session storage
- **RabbitMQ 3.12** for message queuing with Symfony Messenger
- **Nginx 1.25** as the web server
- **Supervisor** for managing background workers
- **Docker** and **Docker Compose** for containerization

## Project Structure

```
service_alex_test/
├── bin/
│   └── console                 # Symfony console entry point
├── config/
│   ├── packages/
│   │   ├── doctrine_mongodb.yaml
│   │   ├── framework.yaml
│   │   ├── messenger.yaml
│   │   ├── monolog.yaml
│   │   ├── routing.yaml
│   │   └── snc_redis.yaml
│   ├── routes/
│   ├── bundles.php
│   ├── preload.php
│   ├── routes.yaml
│   └── services.yaml
├── docker/
│   ├── nginx/
│   │   ├── default.conf
│   │   └── nginx.conf
│   ├── php/
│   │   ├── healthcheck.sh
│   │   ├── php-fpm.conf
│   │   └── php.ini
│   └── supervisor/
│       └── supervisord.conf
├── public/
│   └── index.php               # Application entry point
├── src/
│   ├── Controller/
│   │   └── HealthController.php
│   ├── Document/
│   │   └── Order.php
│   ├── Message/
│   │   └── ExampleMessage.php
│   ├── MessageHandler/
│   │   └── ExampleMessageHandler.php
│   ├── Repository/
│   │   └── OrderRepository.php
│   └── Kernel.php
├── tests/
│   ├── Controller/
│   │   └── HealthControllerTest.php
│   ├── Message/
│   │   └── ExampleMessageTest.php
│   └── bootstrap.php
├── var/
│   ├── cache/
│   └── log/
├── .dockerignore
├── .env
├── .env.example
├── .env.test
├── .gitignore
├── composer.json
├── docker-compose.yml
├── Dockerfile
├── phpunit.xml.dist
├── README.md
└── symfony.lock
```

## Prerequisites

Before running this project, ensure you have the following installed:

- Docker Engine 24.0 or later
- Docker Compose 2.20 or later
- Git

## How to Run the Project

### Step 1: Clone the Repository

```bash
git clone https://github.com/paytronix/service_alex_test.git
cd service_alex_test
```

### Step 2: Configure Environment Variables

Copy the example environment file and modify as needed:

```bash
cp .env.example .env
```

Edit the `.env` file to set your configuration. For local development, the default values should work out of the box.

**Important:** For production, make sure to change `APP_SECRET` to a secure random string:

```bash
# Generate a secure secret
php -r "echo bin2hex(random_bytes(16));"
```

### Step 3: Build the Docker Environment

Build all Docker images:

```bash
docker-compose build
```

### Step 4: Start All Containers

Start all services in detached mode:

```bash
docker-compose up -d
```

This will start the following services:
- php-fpm (port 9000 internal)
- nginx (port 8080)
- mongodb (port 27017)
- redis (port 6379)
- rabbitmq (ports 5672, 15672)
- messenger-worker
- supervisor

### Step 5: Install Dependencies

Install Composer dependencies inside the container:

```bash
docker-compose exec php-fpm composer install
```

### Step 6: Verify the Installation

Check that all services are running:

```bash
docker-compose ps
```

Test the health endpoint:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00+00:00",
    "service": "service_alex_test"
}
```

## Running Tests

### Run All Tests

```bash
docker-compose exec php-fpm php bin/phpunit
```

### Run Specific Test Suite

```bash
docker-compose exec php-fpm php bin/phpunit tests/Controller/
```

### Run Tests with Coverage

```bash
docker-compose exec php-fpm php bin/phpunit --coverage-html var/coverage
```

## Messenger Workers

### Start Messenger Worker Manually

```bash
docker-compose exec php-fpm php bin/console messenger:consume async -vv
```

### View Failed Messages

```bash
docker-compose exec php-fpm php bin/console messenger:failed:show
```

### Retry Failed Messages

```bash
docker-compose exec php-fpm php bin/console messenger:failed:retry
```

## Accessing Services

### Application

- **URL:** http://localhost:8080
- **Health Check:** http://localhost:8080/health

### RabbitMQ Management UI

- **URL:** http://localhost:15672
- **Username:** guest
- **Password:** guest

The management UI allows you to monitor queues, exchanges, connections, and message rates.

### MongoDB

Connect using MongoDB Compass or mongosh:

```bash
mongosh mongodb://localhost:27017/orders
```

Or use the Docker container:

```bash
docker-compose exec mongodb mongosh orders
```

### Redis

Connect using redis-cli:

```bash
docker-compose exec redis redis-cli
```

Common commands:
```bash
# Check connection
PING

# List all keys
KEYS *

# Get server info
INFO
```

## Useful Commands

### Clear Symfony Cache

```bash
docker-compose exec php-fpm php bin/console cache:clear
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f php-fpm
docker-compose logs -f nginx
docker-compose logs -f messenger-worker
```

### Stop All Containers

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

### Rebuild Containers

```bash
docker-compose build --no-cache
docker-compose up -d
```

### Access PHP Container Shell

```bash
docker-compose exec php-fpm sh
```

## Troubleshooting

### Container Won't Start

Check the logs for errors:

```bash
docker-compose logs php-fpm
```

Common issues:
- Port already in use: Change the port mapping in `docker-compose.yml`
- Permission issues: Ensure the `var/` directory is writable

### MongoDB Connection Issues

Verify MongoDB is running:

```bash
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

Check the connection string in `.env`:

```
MONGODB_URL=mongodb://mongodb:27017/orders
```

### RabbitMQ Connection Issues

Verify RabbitMQ is running:

```bash
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping
```

Check the connection string in `.env`:

```
MESSENGER_TRANSPORT_DSN=amqp://guest:guest@rabbitmq:5672/%2f/messages
```

### Redis Connection Issues

Verify Redis is running:

```bash
docker-compose exec redis redis-cli ping
```

Expected response: `PONG`

### Messenger Worker Not Processing Messages

Check if the worker is running:

```bash
docker-compose ps messenger-worker
```

View worker logs:

```bash
docker-compose logs -f messenger-worker
```

Restart the worker:

```bash
docker-compose restart messenger-worker
```

### Permission Denied Errors

Fix permissions on the var directory:

```bash
docker-compose exec php-fpm chown -R appuser:appgroup var/
```

### Composer Memory Issues

Increase PHP memory limit:

```bash
docker-compose exec php-fpm php -d memory_limit=-1 /usr/bin/composer install
```

### Health Check Failing

Verify PHP-FPM is responding:

```bash
docker-compose exec php-fpm php-fpm -t
```

Check nginx configuration:

```bash
docker-compose exec nginx nginx -t
```

## Development Tips

### Hot Reloading

The application code is mounted as a volume, so changes to PHP files are immediately reflected without rebuilding containers.

### Debugging

Enable debug mode in `.env`:

```
APP_ENV=dev
APP_DEBUG=1
```

### Database Indexes

Create MongoDB indexes:

```bash
docker-compose exec php-fpm php bin/console doctrine:mongodb:schema:create
```

### Symfony Console Commands

List all available commands:

```bash
docker-compose exec php-fpm php bin/console list
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| APP_ENV | Application environment (dev, test, prod) | dev |
| APP_SECRET | Secret key for security | change_this |
| APP_DEBUG | Enable debug mode (0 or 1) | 1 |
| MONGODB_URL | MongoDB connection string | mongodb://mongodb:27017/orders |
| MONGODB_DB | MongoDB database name | orders |
| MESSENGER_TRANSPORT_DSN | RabbitMQ connection string | amqp://guest:guest@rabbitmq:5672/%2f/messages |
| REDIS_URL | Redis connection string | redis://redis:6379 |

## License

Proprietary - Paytronix Systems, Inc.
