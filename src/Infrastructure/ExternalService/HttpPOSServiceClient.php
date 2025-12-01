<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class HttpPOSServiceClient implements POSServiceClientInterface
{
    private HttpClientInterface $httpClient;
    private CircuitBreakerService $circuitBreaker;
    private LoggerInterface $logger;
    private string $baseUrl;
    private int $timeout;

    private const SERVICE_NAME = 'pos_service';

    public function __construct(
        HttpClientInterface $httpClient,
        CircuitBreakerService $circuitBreaker,
        LoggerInterface $logger,
        string $baseUrl = 'http://pos-service:8080',
        int $timeout = 15
    ) {
        $this->httpClient = $httpClient;
        $this->circuitBreaker = $circuitBreaker;
        $this->logger = $logger;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    public function sendOrderToPOS(string $orderId, int $itemCount): string
    {
        return $this->executeWithCircuitBreaker('sendOrderToPOS', function () use ($orderId, $itemCount) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/orders', $this->baseUrl), [
                'json' => [
                    'order_id' => $orderId,
                    'item_count' => $itemCount,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode >= 400) {
                $this->logger->error('POS order creation failed', [
                    'status_code' => $statusCode,
                    'order_id' => $orderId,
                ]);
                throw new \RuntimeException('POS order creation failed');
            }

            $data = $response->toArray(false);
            $posOrderId = $data['pos_order_id'] ?? '';

            $this->logger->info('Order sent to POS', [
                'order_id' => $orderId,
                'pos_order_id' => $posOrderId,
            ]);

            return $posOrderId;
        });
    }

    public function cancelOrderInPOS(string $orderId): void
    {
        $this->executeWithCircuitBreaker('cancelOrderInPOS', function () use ($orderId) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/orders/%s/cancel', $this->baseUrl, $orderId), [
                'json' => [
                    'order_id' => $orderId,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            $this->logger->info('Order cancelled in POS', [
                'order_id' => $orderId,
                'status_code' => $statusCode,
            ]);
        });
    }

    public function updateOrderInPOS(string $orderId, array $items): void
    {
        $this->executeWithCircuitBreaker('updateOrderInPOS', function () use ($orderId, $items) {
            $response = $this->httpClient->request('PATCH', sprintf('%s/api/orders/%s', $this->baseUrl, $orderId), [
                'json' => [
                    'order_id' => $orderId,
                    'items' => $items,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            $this->logger->info('Order updated in POS', [
                'order_id' => $orderId,
                'status_code' => $statusCode,
            ]);
        });
    }

    public function getOrderStatusFromPOS(string $orderId): ?string
    {
        return $this->executeWithCircuitBreaker('getOrderStatusFromPOS', function () use ($orderId) {
            $response = $this->httpClient->request('GET', sprintf('%s/api/orders/%s', $this->baseUrl, $orderId), [
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode === 404) {
                return null;
            }

            $data = $response->toArray(false);
            return $data['status'] ?? null;
        });
    }

    private function executeWithCircuitBreaker(string $operation, callable $callback): mixed
    {
        if (!$this->circuitBreaker->isAvailable(self::SERVICE_NAME)) {
            $this->logger->warning('Circuit breaker is open for POS service', [
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
            $this->logger->error('Transport error calling POS service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw RetryableException::connectionFailed(self::SERVICE_NAME, $e);
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error calling POS service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
