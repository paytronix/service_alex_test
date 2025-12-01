<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class HttpRestaurantServiceClient implements RestaurantServiceClientInterface
{
    private HttpClientInterface $httpClient;
    private CircuitBreakerService $circuitBreaker;
    private LoggerInterface $logger;
    private string $baseUrl;
    private int $timeout;

    private const SERVICE_NAME = 'restaurant_service';

    public function __construct(
        HttpClientInterface $httpClient,
        CircuitBreakerService $circuitBreaker,
        LoggerInterface $logger,
        string $baseUrl = 'http://restaurant-service:8080',
        int $timeout = 10
    ) {
        $this->httpClient = $httpClient;
        $this->circuitBreaker = $circuitBreaker;
        $this->logger = $logger;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    public function notifyOrderCreated(string $orderId, string $customerEmail): void
    {
        $this->executeWithCircuitBreaker('notifyOrderCreated', function () use ($orderId, $customerEmail) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/orders/notify', $this->baseUrl), [
                'json' => [
                    'order_id' => $orderId,
                    'customer_email' => $customerEmail,
                    'event_type' => 'created',
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode >= 400) {
                $this->logger->warning('Restaurant service returned client error', [
                    'status_code' => $statusCode,
                    'order_id' => $orderId,
                ]);
            }

            $this->logger->info('Restaurant notified of order creation', [
                'order_id' => $orderId,
                'status_code' => $statusCode,
            ]);
        });
    }

    public function notifyOrderCancelled(string $orderId, string $reason): void
    {
        $this->executeWithCircuitBreaker('notifyOrderCancelled', function () use ($orderId, $reason) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/orders/notify', $this->baseUrl), [
                'json' => [
                    'order_id' => $orderId,
                    'reason' => $reason,
                    'event_type' => 'cancelled',
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            $this->logger->info('Restaurant notified of order cancellation', [
                'order_id' => $orderId,
                'reason' => $reason,
                'status_code' => $statusCode,
            ]);
        });
    }

    public function checkRestaurantAvailability(string $restaurantId): bool
    {
        return $this->executeWithCircuitBreaker('checkRestaurantAvailability', function () use ($restaurantId) {
            $response = $this->httpClient->request('GET', sprintf('%s/api/restaurants/%s/availability', $this->baseUrl, $restaurantId), [
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode === 404) {
                $this->logger->warning('Restaurant not found', [
                    'restaurant_id' => $restaurantId,
                ]);
                return false;
            }

            $data = $response->toArray(false);

            return $data['available'] ?? false;
        });
    }

    public function getRestaurantDetails(string $restaurantId): ?array
    {
        return $this->executeWithCircuitBreaker('getRestaurantDetails', function () use ($restaurantId) {
            $response = $this->httpClient->request('GET', sprintf('%s/api/restaurants/%s', $this->baseUrl, $restaurantId), [
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode === 404) {
                return null;
            }

            return $response->toArray(false);
        });
    }

    private function executeWithCircuitBreaker(string $operation, callable $callback): mixed
    {
        if (!$this->circuitBreaker->isAvailable(self::SERVICE_NAME)) {
            $this->logger->warning('Circuit breaker is open for restaurant service', [
                'operation' => $operation,
            ]);
            throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
        }

        try {
            $result = $callback();
            $this->circuitBreaker->recordSuccess(self::SERVICE_NAME);
            return $result;
        } catch (TransportExceptionInterface $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            $this->logger->error('Transport error calling restaurant service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw RetryableException::connectionFailed(self::SERVICE_NAME, $e);
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error calling restaurant service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
