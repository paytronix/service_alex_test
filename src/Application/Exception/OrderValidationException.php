<?php

declare(strict_types=1);

namespace App\Application\Exception;

use DomainException;

final class OrderValidationException extends DomainException
{
    private array $errors;

    public function __construct(string $message, array $errors = [], int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->errors = $errors;
    }

    public static function invalidCustomerData(string $message): self
    {
        return new self($message, ['customer' => $message]);
    }

    public static function invalidItems(array $errors): self
    {
        return new self('Invalid order items', $errors);
    }

    public static function itemNotAvailable(string $productId): self
    {
        return new self(
            sprintf('Item with product ID %s is not available', $productId),
            ['items' => [sprintf('Product %s is not available', $productId)]]
        );
    }

    public static function emptyOrder(): self
    {
        return new self('Order must contain at least one item', ['items' => 'Order must contain at least one item']);
    }

    public static function invalidStatus(string $currentStatus, string $newStatus): self
    {
        return new self(
            sprintf('Cannot transition from %s to %s', $currentStatus, $newStatus),
            ['status' => sprintf('Invalid status transition from %s to %s', $currentStatus, $newStatus)]
        );
    }

    public static function orderNotFound(string $orderId): self
    {
        return new self(
            sprintf('Order with ID %s not found', $orderId),
            ['order_id' => 'Order not found']
        );
    }

    public function errors(): array
    {
        return $this->errors;
    }
}
