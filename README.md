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
- **API Platform** for REST API development
- **LexikJWTAuthenticationBundle** for JWT-based authentication

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
| JWT_SECRET_KEY | Path to JWT private key | %kernel.project_dir%/config/jwt/private.pem |
| JWT_PUBLIC_KEY | Path to JWT public key | %kernel.project_dir%/config/jwt/public.pem |
| JWT_PASSPHRASE | Passphrase for JWT private key | your_passphrase_here |

## Installing Packages

The following Symfony packages are required for this microservice. Install them using Composer:

```bash
# Install all required packages at once
docker-compose exec php-fpm composer require \
    doctrine/mongodb-odm-bundle \
    api-platform/core \
    symfony/messenger \
    lexik/jwt-authentication-bundle \
    symfony/validator \
    symfony/http-client \
    symfony/serializer \
    symfony/property-access \
    symfony/property-info
```

Or install them individually:

```bash
# MongoDB ODM for document storage
docker-compose exec php-fpm composer require doctrine/mongodb-odm-bundle

# API Platform for REST API development
docker-compose exec php-fpm composer require api-platform/core

# Symfony Messenger for async message processing
docker-compose exec php-fpm composer require symfony/messenger

# JWT Authentication
docker-compose exec php-fpm composer require lexik/jwt-authentication-bundle

# Validation
docker-compose exec php-fpm composer require symfony/validator

# HTTP Client for external API calls
docker-compose exec php-fpm composer require symfony/http-client

# Serializer for data transformation
docker-compose exec php-fpm composer require symfony/serializer

# Property Access and Info for object manipulation
docker-compose exec php-fpm composer require symfony/property-access symfony/property-info
```

## Generating JWT Keys

JWT keys are required for authentication. Generate them using the following commands:

### Step 1: Create the JWT Directory

```bash
mkdir -p config/jwt
```

### Step 2: Generate the Private Key

```bash
openssl genpkey -out config/jwt/private.pem -aes256 -algorithm rsa -pkeyopt rsa_keygen_bits:4096 -pass pass:your_passphrase_here
```

### Step 3: Generate the Public Key

```bash
openssl pkey -in config/jwt/private.pem -out config/jwt/public.pem -pubout -passin pass:your_passphrase_here
```

### Step 4: Set Correct Permissions

```bash
chmod 600 config/jwt/private.pem
chmod 644 config/jwt/public.pem
```

### Step 5: Update Environment Variables

Make sure your `.env` file contains the correct JWT configuration:

```bash
JWT_SECRET_KEY=%kernel.project_dir%/config/jwt/private.pem
JWT_PUBLIC_KEY=%kernel.project_dir%/config/jwt/public.pem
JWT_PASSPHRASE=your_passphrase_here
```

The `.gitignore` file already excludes JWT keys from version control:

```
/config/jwt/*.pem
```

## MongoDB ODM Migrations

MongoDB ODM does not use traditional migrations like SQL databases. Instead, use the following commands to manage your schema:

### Create Schema Indexes

```bash
docker-compose exec php-fpm php bin/console doctrine:mongodb:schema:create
```

### Update Schema Indexes

```bash
docker-compose exec php-fpm php bin/console doctrine:mongodb:schema:update
```

### Drop Schema Indexes

```bash
docker-compose exec php-fpm php bin/console doctrine:mongodb:schema:drop
```

### Generate Hydrators and Proxies

```bash
docker-compose exec php-fpm php bin/console doctrine:mongodb:generate:hydrators
docker-compose exec php-fpm php bin/console doctrine:mongodb:generate:proxies
```

## Running Messenger Worker

The Messenger component handles asynchronous message processing. Here are the commands to manage workers:

### Start Worker in Foreground

```bash
docker-compose exec php-fpm php bin/console messenger:consume async -vv
```

### Start Worker with Time Limit

```bash
docker-compose exec php-fpm php bin/console messenger:consume async --time-limit=3600 -vv
```

### Start Worker with Memory Limit

```bash
docker-compose exec php-fpm php bin/console messenger:consume async --memory-limit=128M -vv
```

### Start Worker with Message Limit

```bash
docker-compose exec php-fpm php bin/console messenger:consume async --limit=100 -vv
```

### View Pending Messages

```bash
docker-compose exec php-fpm php bin/console messenger:stats
```

### View Failed Messages

```bash
docker-compose exec php-fpm php bin/console messenger:failed:show
```

### Retry Failed Messages

```bash
docker-compose exec php-fpm php bin/console messenger:failed:retry
```

### Remove Failed Messages

```bash
docker-compose exec php-fpm php bin/console messenger:failed:remove <id>
```

## Testing Authentication (JWT Token Generation)

### Step 1: Obtain a JWT Token

Send a POST request to the login endpoint with valid credentials:

```bash
curl -X POST http://localhost:8080/api/login_check \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin"}'
```

Expected response:

```json
{
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
}
```

### Step 2: Use the Token for Authenticated Requests

Include the token in the Authorization header:

```bash
curl -X GET http://localhost:8080/api/orders \
    -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
```

### Step 3: Verify Token Contents

You can decode the JWT token to inspect its contents at https://jwt.io or using the command line:

```bash
# Extract the payload (second part of the token)
echo "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE3..." | cut -d. -f2 | base64 -d
```

### Token Configuration

The JWT token is configured with the following settings in `config/packages/lexik_jwt_authentication.yaml`:

- **token_ttl**: 3600 seconds (1 hour)
- **user_identity_field**: username
- **token_extractors**: Authorization header with Bearer prefix

### Public Endpoints

The following endpoints are accessible without authentication:

- `GET /health` - Health check endpoint
- `GET /api` - API entrypoint
- `GET /api/docs` - API documentation (Swagger UI)
- `POST /api/login_check` - JWT token generation

### Protected Endpoints

All other `/api/*` endpoints require a valid JWT token.

## API Platform

API Platform provides automatic REST API generation. Access the API documentation at:

- **Swagger UI**: http://localhost:8080/api/docs
- **JSON-LD**: http://localhost:8080/api
- **ReDoc**: http://localhost:8080/api/docs?ui=re_doc

### Creating API Resources

Create API resources in the `src/ApiResource/` or `src/Document/` directories using PHP attributes:

```php
<?php

namespace App\Document;

use ApiPlatform\Metadata\ApiResource;
use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;

#[ApiResource]
#[MongoDB\Document(collection: 'orders')]
class Order
{
    #[MongoDB\Id]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    private string $status;

    // ... getters and setters
}
```

## License

Proprietary - Paytronix Systems, Inc.
