<?php

declare(strict_types=1);

namespace App\Domain\ValueObject;

use InvalidArgumentException;

final class OrderStatus
{
    public const DRAFT = 'draft';
    public const SUBMITTED = 'submitted';
    public const CONFIRMED = 'confirmed';
    public const PROCESSING = 'processing';
    public const SHIPPED = 'shipped';
    public const DELIVERED = 'delivered';
    public const CANCELLED = 'cancelled';
    public const REFUNDED = 'refunded';

    private const VALID_STATUSES = [
        self::DRAFT,
        self::SUBMITTED,
        self::CONFIRMED,
        self::PROCESSING,
        self::SHIPPED,
        self::DELIVERED,
        self::CANCELLED,
        self::REFUNDED,
    ];

    private const ALLOWED_TRANSITIONS = [
        self::DRAFT => [self::SUBMITTED, self::CANCELLED],
        self::SUBMITTED => [self::CONFIRMED, self::CANCELLED],
        self::CONFIRMED => [self::PROCESSING, self::CANCELLED],
        self::PROCESSING => [self::SHIPPED, self::CANCELLED],
        self::SHIPPED => [self::DELIVERED, self::REFUNDED],
        self::DELIVERED => [self::REFUNDED],
        self::CANCELLED => [],
        self::REFUNDED => [],
    ];

    private string $value;

    private function __construct(string $value)
    {
        if (!in_array($value, self::VALID_STATUSES, true)) {
            throw new InvalidArgumentException(
                sprintf('Invalid order status: %s. Valid statuses are: %s', $value, implode(', ', self::VALID_STATUSES))
            );
        }

        $this->value = $value;
    }

    public static function draft(): self
    {
        return new self(self::DRAFT);
    }

    public static function submitted(): self
    {
        return new self(self::SUBMITTED);
    }

    public static function confirmed(): self
    {
        return new self(self::CONFIRMED);
    }

    public static function processing(): self
    {
        return new self(self::PROCESSING);
    }

    public static function shipped(): self
    {
        return new self(self::SHIPPED);
    }

    public static function delivered(): self
    {
        return new self(self::DELIVERED);
    }

    public static function cancelled(): self
    {
        return new self(self::CANCELLED);
    }

    public static function refunded(): self
    {
        return new self(self::REFUNDED);
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function equals(OrderStatus $other): bool
    {
        return $this->value === $other->value;
    }

    public function isDraft(): bool
    {
        return $this->value === self::DRAFT;
    }

    public function isSubmitted(): bool
    {
        return $this->value === self::SUBMITTED;
    }

    public function isConfirmed(): bool
    {
        return $this->value === self::CONFIRMED;
    }

    public function isProcessing(): bool
    {
        return $this->value === self::PROCESSING;
    }

    public function isShipped(): bool
    {
        return $this->value === self::SHIPPED;
    }

    public function isDelivered(): bool
    {
        return $this->value === self::DELIVERED;
    }

    public function isCancelled(): bool
    {
        return $this->value === self::CANCELLED;
    }

    public function isRefunded(): bool
    {
        return $this->value === self::REFUNDED;
    }

    public function isFinal(): bool
    {
        return in_array($this->value, [self::CANCELLED, self::REFUNDED, self::DELIVERED], true);
    }

    public function canTransitionTo(OrderStatus $newStatus): bool
    {
        $allowedTransitions = self::ALLOWED_TRANSITIONS[$this->value] ?? [];

        return in_array($newStatus->value, $allowedTransitions, true);
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
