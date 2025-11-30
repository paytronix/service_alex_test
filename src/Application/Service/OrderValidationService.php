<?php

declare(strict_types=1);

namespace App\Application\Service;

use App\Application\Exception\OrderValidationException;
use App\Domain\ValueObject\OrderStatus;

final class OrderValidationService implements OrderValidationServiceInterface
{
    public function __construct(
        private readonly MenuServiceClientInterface $menuServiceClient,
    ) {
    }

    public function validateCreate(array $payload): void
    {
        $this->validateCustomerData($payload);
        
        if (isset($payload['items']) && is_array($payload['items'])) {
            $this->validateItems($payload['items']);
        }
    }

    public function validateItems(array $items): void
    {
        if (empty($items)) {
            return;
        }

        $productIds = [];
        foreach ($items as $item) {
            if (!isset($item['product_id']) || empty($item['product_id'])) {
                throw OrderValidationException::invalidItems(['product_id' => 'Product ID is required for each item']);
            }
            $productIds[] = $item['product_id'];
        }

        $availability = $this->menuServiceClient->areItemsAvailable($productIds);

        $unavailableItems = [];
        foreach ($availability as $productId => $isAvailable) {
            if (!$isAvailable) {
                $unavailableItems[] = $productId;
            }
        }

        if (!empty($unavailableItems)) {
            throw OrderValidationException::invalidItems([
                'unavailable_items' => $unavailableItems,
                'message' => sprintf('The following items are not available: %s', implode(', ', $unavailableItems)),
            ]);
        }
    }

    public function validateStatusTransition(string $currentStatus, string $newStatus): void
    {
        try {
            $current = OrderStatus::fromString($currentStatus);
            $new = OrderStatus::fromString($newStatus);
        } catch (\InvalidArgumentException $e) {
            throw OrderValidationException::invalidStatus($currentStatus, $newStatus);
        }

        if (!$current->canTransitionTo($new)) {
            throw OrderValidationException::invalidStatus($currentStatus, $newStatus);
        }
    }

    private function validateCustomerData(array $payload): void
    {
        $requiredFields = ['customer_email', 'customer_first_name', 'customer_last_name'];

        foreach ($requiredFields as $field) {
            if (!isset($payload[$field]) || empty($payload[$field])) {
                throw OrderValidationException::invalidCustomerData(
                    sprintf('Customer %s is required', str_replace('customer_', '', $field))
                );
            }
        }

        if (!filter_var($payload['customer_email'], FILTER_VALIDATE_EMAIL)) {
            throw OrderValidationException::invalidCustomerData('Invalid email format');
        }
    }
}
