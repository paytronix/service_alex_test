<?php

declare(strict_types=1);

namespace App\Application\Service;

interface MenuServiceClientInterface
{
    /**
     * Check if a menu item is available.
     *
     * @param string $productId The product ID to check
     * @return bool True if the item is available, false otherwise
     */
    public function isItemAvailable(string $productId): bool;

    /**
     * Check if multiple menu items are available.
     *
     * @param array<string> $productIds Array of product IDs to check
     * @return array<string, bool> Map of product ID to availability status
     */
    public function areItemsAvailable(array $productIds): array;

    /**
     * Get item details by product ID.
     *
     * @param string $productId The product ID
     * @return array|null Item details or null if not found
     */
    public function getItemDetails(string $productId): ?array;
}
