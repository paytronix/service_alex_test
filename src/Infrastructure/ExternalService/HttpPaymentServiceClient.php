<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class HttpPaymentServiceClient implements PaymentServiceClientInterface
{
    private HttpClientInterface $httpClient;
    private CircuitBreakerService $circuitBreaker;
    private LoggerInterface $logger;
    private string $baseUrl;
    private int $timeout;

    private const SERVICE_NAME = 'payment_service';

    public function __construct(
        HttpClientInterface $httpClient,
        CircuitBreakerService $circuitBreaker,
        LoggerInterface $logger,
        string $baseUrl = 'http://payment-service:8080',
        int $timeout = 30
    ) {
        $this->httpClient = $httpClient;
        $this->circuitBreaker = $circuitBreaker;
        $this->logger = $logger;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    public function initiatePayment(string $orderId, string $amount, string $currency): string
    {
        return $this->executeWithCircuitBreaker('initiatePayment', function () use ($orderId, $amount, $currency) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/payments', $this->baseUrl), [
                'json' => [
                    'order_id' => $orderId,
                    'amount' => $amount,
                    'currency' => $currency,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode >= 400) {
                $this->logger->error('Payment initiation failed', [
                    'status_code' => $statusCode,
                    'order_id' => $orderId,
                ]);
                throw new \RuntimeException('Payment initiation failed');
            }

            $data = $response->toArray(false);
            $paymentId = $data['payment_id'] ?? '';

            $this->logger->info('Payment initiated', [
                'order_id' => $orderId,
                'payment_id' => $paymentId,
                'amount' => $amount,
                'currency' => $currency,
            ]);

            return $paymentId;
        });
    }

    public function cancelPayment(string $orderId): void
    {
        $this->executeWithCircuitBreaker('cancelPayment', function () use ($orderId) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/payments/%s/cancel', $this->baseUrl, $orderId), [
                'json' => [
                    'order_id' => $orderId,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            $this->logger->info('Payment cancelled', [
                'order_id' => $orderId,
                'status_code' => $statusCode,
            ]);
        });
    }

    public function refundPayment(string $orderId, string $amount, string $currency): string
    {
        return $this->executeWithCircuitBreaker('refundPayment', function () use ($orderId, $amount, $currency) {
            $response = $this->httpClient->request('POST', sprintf('%s/api/payments/%s/refund', $this->baseUrl, $orderId), [
                'json' => [
                    'order_id' => $orderId,
                    'amount' => $amount,
                    'currency' => $currency,
                ],
                'timeout' => $this->timeout,
            ]);

            $statusCode = $response->getStatusCode();

            if ($statusCode >= 500) {
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            if ($statusCode >= 400) {
                $this->logger->error('Payment refund failed', [
                    'status_code' => $statusCode,
                    'order_id' => $orderId,
                ]);
                throw new \RuntimeException('Payment refund failed');
            }

            $data = $response->toArray(false);
            $refundId = $data['refund_id'] ?? '';

            $this->logger->info('Payment refunded', [
                'order_id' => $orderId,
                'refund_id' => $refundId,
            ]);

            return $refundId;
        });
    }

    public function getPaymentStatus(string $orderId): ?string
    {
        return $this->executeWithCircuitBreaker('getPaymentStatus', function () use ($orderId) {
            $response = $this->httpClient->request('GET', sprintf('%s/api/payments/%s', $this->baseUrl, $orderId), [
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
            $this->logger->warning('Circuit breaker is open for payment service', [
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
            $this->logger->error('Transport error calling payment service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw RetryableException::connectionFailed(self::SERVICE_NAME, $e);
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error calling payment service', [
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
