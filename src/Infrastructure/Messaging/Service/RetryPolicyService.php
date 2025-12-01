<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Service;

use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use Psr\Log\LoggerInterface;

final class RetryPolicyService
{
    private LoggerInterface $logger;
    private int $maxRetries;
    private int $baseDelayMs;
    private float $multiplier;
    private int $maxDelayMs;

    public function __construct(
        LoggerInterface $logger,
        int $maxRetries = 3,
        int $baseDelayMs = 1000,
        float $multiplier = 2.0,
        int $maxDelayMs = 60000
    ) {
        $this->logger = $logger;
        $this->maxRetries = $maxRetries;
        $this->baseDelayMs = $baseDelayMs;
        $this->multiplier = $multiplier;
        $this->maxDelayMs = $maxDelayMs;
    }

    public function shouldRetry(\Throwable $exception, int $attemptNumber): bool
    {
        if ($exception instanceof NonRetryableException) {
            $this->logger->info('Exception is non-retryable', [
                'exception_class' => get_class($exception),
                'message' => $exception->getMessage(),
                'attempt' => $attemptNumber,
            ]);
            return false;
        }

        if ($attemptNumber >= $this->maxRetries) {
            $this->logger->warning('Max retries exceeded', [
                'exception_class' => get_class($exception),
                'message' => $exception->getMessage(),
                'attempt' => $attemptNumber,
                'max_retries' => $this->maxRetries,
            ]);
            return false;
        }

        if ($exception instanceof RetryableException) {
            $this->logger->info('Exception is retryable', [
                'exception_class' => get_class($exception),
                'message' => $exception->getMessage(),
                'attempt' => $attemptNumber,
            ]);
            return true;
        }

        if ($this->isTransientException($exception)) {
            $this->logger->info('Transient exception detected, will retry', [
                'exception_class' => get_class($exception),
                'message' => $exception->getMessage(),
                'attempt' => $attemptNumber,
            ]);
            return true;
        }

        $this->logger->info('Unknown exception type, will not retry', [
            'exception_class' => get_class($exception),
            'message' => $exception->getMessage(),
            'attempt' => $attemptNumber,
        ]);

        return false;
    }

    public function calculateDelay(int $attemptNumber): int
    {
        $delay = (int) ($this->baseDelayMs * pow($this->multiplier, $attemptNumber - 1));
        $delay = min($delay, $this->maxDelayMs);

        $jitter = random_int(0, (int) ($delay * 0.1));
        $delay += $jitter;

        $this->logger->debug('Calculated retry delay', [
            'attempt' => $attemptNumber,
            'delay_ms' => $delay,
            'base_delay_ms' => $this->baseDelayMs,
            'multiplier' => $this->multiplier,
        ]);

        return $delay;
    }

    public function getMaxRetries(): int
    {
        return $this->maxRetries;
    }

    public function wrapRetryable(\Throwable $exception, string $context = ''): RetryableException
    {
        return new RetryableException(
            sprintf('%s: %s', $context ?: 'Retryable error', $exception->getMessage()),
            (int) $exception->getCode(),
            $exception
        );
    }

    public function wrapNonRetryable(\Throwable $exception, string $context = ''): NonRetryableException
    {
        return new NonRetryableException(
            sprintf('%s: %s', $context ?: 'Non-retryable error', $exception->getMessage()),
            (int) $exception->getCode(),
            $exception
        );
    }

    private function isTransientException(\Throwable $exception): bool
    {
        $transientPatterns = [
            'connection',
            'timeout',
            'temporarily unavailable',
            'service unavailable',
            'too many requests',
            'rate limit',
            'network',
            'socket',
            'ECONNREFUSED',
            'ETIMEDOUT',
        ];

        $message = strtolower($exception->getMessage());

        foreach ($transientPatterns as $pattern) {
            if (str_contains($message, strtolower($pattern))) {
                return true;
            }
        }

        return false;
    }
}
