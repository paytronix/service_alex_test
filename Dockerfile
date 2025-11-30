# Stage 1: Builder
FROM php:8.2-fpm-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    autoconf \
    g++ \
    make \
    linux-headers \
    openssl-dev \
    rabbitmq-c-dev \
    git \
    unzip \
    curl \
    icu-dev \
    libzip-dev \
    oniguruma-dev

# Install PHP extensions
RUN docker-php-ext-install \
    intl \
    opcache \
    zip \
    mbstring \
    pdo

# Install MongoDB extension (version 1.19.x for compatibility with doctrine/mongodb-odm-bundle)
RUN pecl install mongodb-1.19.4 && docker-php-ext-enable mongodb

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install AMQP extension
RUN pecl install amqp && docker-php-ext-enable amqp

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy composer files first for better caching
COPY composer.json composer.lock* ./

# Install dependencies
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Copy application source
COPY . .

# Generate optimized autoloader
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative

# Stage 2: Production
FROM php:8.2-fpm-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    icu-libs \
    libzip \
    oniguruma \
    rabbitmq-c \
    fcgi \
    supervisor

# Copy PHP extensions from builder
COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

# Copy Composer from builder for development use
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy application from builder
COPY --from=builder --chown=appuser:appgroup /app /app

# Create required directories
RUN mkdir -p var/cache var/log && \
    chown -R appuser:appgroup var

# Copy PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/php.ini
COPY docker/php/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

# Health check script
COPY docker/php/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

CMD ["php-fpm"]
