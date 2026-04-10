<?php

declare(strict_types=1);

namespace App\Application\Service;

use App\Application\Exception\OrderValidationException;

interface OrderValidationServiceInterface
{
    /**
     * Validate order creation payload.
     *
     * @param array $payload The order creation payload
     * @throws OrderValidationException If validation fails
     */
    public function validateCreate(array $payload): void;

    /**
     * Validate order items for availability.
     *
     * @param array $items Array of items with 'product_id' key
     * @throws OrderValidationException If any item is not available
     */
    public function validateItems(array $items): void;

    /**
     * Validate status transition.
     *
     * @param string $currentStatus Current order status
     * @param string $newStatus New order status
     * @throws OrderValidationException If transition is not allowed
     */
    public function validateStatusTransition(string $currentStatus, string $newStatus): void;
}
