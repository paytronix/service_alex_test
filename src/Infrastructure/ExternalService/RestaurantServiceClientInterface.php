<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

interface RestaurantServiceClientInterface
{
    public function notifyOrderCreated(string $orderId, string $customerEmail): void;

    public function notifyOrderCancelled(string $orderId, string $reason): void;

    public function checkRestaurantAvailability(string $restaurantId): bool;

    public function getRestaurantDetails(string $restaurantId): ?array;
}
