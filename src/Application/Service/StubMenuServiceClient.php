<?php

declare(strict_types=1);

namespace App\Application\Service;

final class StubMenuServiceClient implements MenuServiceClientInterface
{
    public function isItemAvailable(string $productId): bool
    {
        return true;
    }

    public function areItemsAvailable(array $productIds): array
    {
        $result = [];
        foreach ($productIds as $productId) {
            $result[$productId] = true;
        }

        return $result;
    }

    public function getItemDetails(string $productId): ?array
    {
        return [
            'id' => $productId,
            'name' => 'Stub Product',
            'price' => 1000,
            'currency' => 'USD',
            'available' => true,
        ];
    }
}
