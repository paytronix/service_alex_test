<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Service;

use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;

final class CircuitBreakerService
{
    private const STATE_CLOSED = 'closed';
    private const STATE_OPEN = 'open';
    private const STATE_HALF_OPEN = 'half_open';

    private CacheItemPoolInterface $cache;
    private LoggerInterface $logger;
    private int $failureThreshold;
    private int $recoveryTimeSeconds;
    private int $halfOpenMaxAttempts;

    public function __construct(
        CacheItemPoolInterface $cache,
        LoggerInterface $logger,
        int $failureThreshold = 5,
        int $recoveryTimeSeconds = 30,
        int $halfOpenMaxAttempts = 3
    ) {
        $this->cache = $cache;
        $this->logger = $logger;
        $this->failureThreshold = $failureThreshold;
        $this->recoveryTimeSeconds = $recoveryTimeSeconds;
        $this->halfOpenMaxAttempts = $halfOpenMaxAttempts;
    }

    public function isAvailable(string $serviceName): bool
    {
        $state = $this->getState($serviceName);

        if ($state['state'] === self::STATE_CLOSED) {
            return true;
        }

        if ($state['state'] === self::STATE_OPEN) {
            $openedAt = $state['opened_at'] ?? 0;
            $elapsed = time() - $openedAt;

            if ($elapsed >= $this->recoveryTimeSeconds) {
                $this->transitionToHalfOpen($serviceName);
                return true;
            }

            $this->logger->debug('Circuit breaker is open', [
                'service' => $serviceName,
                'elapsed_seconds' => $elapsed,
                'recovery_time_seconds' => $this->recoveryTimeSeconds,
            ]);

            return false;
        }

        if ($state['state'] === self::STATE_HALF_OPEN) {
            $attempts = $state['half_open_attempts'] ?? 0;
            return $attempts < $this->halfOpenMaxAttempts;
        }

        return true;
    }

    public function recordSuccess(string $serviceName): void
    {
        $state = $this->getState($serviceName);

        if ($state['state'] === self::STATE_HALF_OPEN) {
            $this->transitionToClosed($serviceName);
            $this->logger->info('Circuit breaker closed after successful half-open attempt', [
                'service' => $serviceName,
            ]);
        } elseif ($state['state'] === self::STATE_CLOSED) {
            $this->resetFailureCount($serviceName);
        }
    }

    public function recordFailure(string $serviceName, \Throwable $exception): void
    {
        $state = $this->getState($serviceName);

        if ($state['state'] === self::STATE_HALF_OPEN) {
            $attempts = ($state['half_open_attempts'] ?? 0) + 1;

            if ($attempts >= $this->halfOpenMaxAttempts) {
                $this->transitionToOpen($serviceName);
                $this->logger->warning('Circuit breaker reopened after half-open failures', [
                    'service' => $serviceName,
                    'attempts' => $attempts,
                    'error' => $exception->getMessage(),
                ]);
            } else {
                $this->incrementHalfOpenAttempts($serviceName, $attempts);
            }
        } elseif ($state['state'] === self::STATE_CLOSED) {
            $failures = ($state['failure_count'] ?? 0) + 1;

            if ($failures >= $this->failureThreshold) {
                $this->transitionToOpen($serviceName);
                $this->logger->warning('Circuit breaker opened due to failures', [
                    'service' => $serviceName,
                    'failures' => $failures,
                    'threshold' => $this->failureThreshold,
                    'error' => $exception->getMessage(),
                ]);
            } else {
                $this->incrementFailureCount($serviceName, $failures);
                $this->logger->debug('Circuit breaker failure recorded', [
                    'service' => $serviceName,
                    'failures' => $failures,
                    'threshold' => $this->failureThreshold,
                ]);
            }
        }
    }

    public function getState(string $serviceName): array
    {
        $key = $this->generateKey($serviceName);

        try {
            $item = $this->cache->getItem($key);

            if ($item->isHit()) {
                return $item->get();
            }
        } catch (\Throwable $e) {
            $this->logger->warning('Failed to get circuit breaker state', [
                'service' => $serviceName,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'state' => self::STATE_CLOSED,
            'failure_count' => 0,
            'opened_at' => null,
            'half_open_attempts' => 0,
        ];
    }

    public function reset(string $serviceName): void
    {
        $this->transitionToClosed($serviceName);
        $this->logger->info('Circuit breaker manually reset', [
            'service' => $serviceName,
        ]);
    }

    private function transitionToOpen(string $serviceName): void
    {
        $this->saveState($serviceName, [
            'state' => self::STATE_OPEN,
            'failure_count' => 0,
            'opened_at' => time(),
            'half_open_attempts' => 0,
        ]);
    }

    private function transitionToHalfOpen(string $serviceName): void
    {
        $this->saveState($serviceName, [
            'state' => self::STATE_HALF_OPEN,
            'failure_count' => 0,
            'opened_at' => null,
            'half_open_attempts' => 0,
        ]);

        $this->logger->info('Circuit breaker transitioned to half-open', [
            'service' => $serviceName,
        ]);
    }

    private function transitionToClosed(string $serviceName): void
    {
        $this->saveState($serviceName, [
            'state' => self::STATE_CLOSED,
            'failure_count' => 0,
            'opened_at' => null,
            'half_open_attempts' => 0,
        ]);
    }

    private function incrementFailureCount(string $serviceName, int $count): void
    {
        $state = $this->getState($serviceName);
        $state['failure_count'] = $count;
        $this->saveState($serviceName, $state);
    }

    private function incrementHalfOpenAttempts(string $serviceName, int $attempts): void
    {
        $state = $this->getState($serviceName);
        $state['half_open_attempts'] = $attempts;
        $this->saveState($serviceName, $state);
    }

    private function resetFailureCount(string $serviceName): void
    {
        $state = $this->getState($serviceName);
        if ($state['failure_count'] > 0) {
            $state['failure_count'] = 0;
            $this->saveState($serviceName, $state);
        }
    }

    private function saveState(string $serviceName, array $state): void
    {
        $key = $this->generateKey($serviceName);

        try {
            $item = $this->cache->getItem($key);
            $item->set($state);
            $item->expiresAfter(3600);
            $this->cache->save($item);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to save circuit breaker state', [
                'service' => $serviceName,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function generateKey(string $serviceName): string
    {
        return sprintf('circuit_breaker_%s', $serviceName);
    }
}
