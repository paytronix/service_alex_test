<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Exception;

use Symfony\Component\Messenger\Exception\RecoverableMessageHandlingException;

final class RetryableException extends RecoverableMessageHandlingException
{
    private ?string $correlationId = null;
    private array $context = [];

    public function __construct(string $message = '', int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }

    public static function fromException(\Throwable $exception, string $context = ''): self
    {
        $message = $context ? sprintf('%s: %s', $context, $exception->getMessage()) : $exception->getMessage();
        return new self($message, (int) $exception->getCode(), $exception);
    }

    public static function serviceUnavailable(string $serviceName, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Service %s is temporarily unavailable', $serviceName),
            503,
            $previous
        );
    }

    public static function timeout(string $operation, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Operation %s timed out', $operation),
            504,
            $previous
        );
    }

    public static function connectionFailed(string $target, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Connection to %s failed', $target),
            503,
            $previous
        );
    }

    public function withCorrelationId(string $correlationId): self
    {
        $this->correlationId = $correlationId;
        return $this;
    }

    public function withContext(array $context): self
    {
        $this->context = $context;
        return $this;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function getContext(): array
    {
        return $this->context;
    }
}
