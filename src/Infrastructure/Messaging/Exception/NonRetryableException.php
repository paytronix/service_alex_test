<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Exception;

use Symfony\Component\Messenger\Exception\UnrecoverableMessageHandlingException;

final class NonRetryableException extends UnrecoverableMessageHandlingException
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

    public static function invalidMessage(string $reason, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Invalid message: %s', $reason),
            400,
            $previous
        );
    }

    public static function validationFailed(string $field, string $reason, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Validation failed for field %s: %s', $field, $reason),
            422,
            $previous
        );
    }

    public static function businessRuleViolation(string $rule, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Business rule violation: %s', $rule),
            422,
            $previous
        );
    }

    public static function resourceNotFound(string $resourceType, string $resourceId, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('%s with ID %s not found', $resourceType, $resourceId),
            404,
            $previous
        );
    }

    public static function duplicateMessage(string $messageId, ?\Throwable $previous = null): self
    {
        return new self(
            sprintf('Duplicate message detected: %s', $messageId),
            409,
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
