<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

interface POSServiceClientInterface
{
    public function sendOrderToPOS(string $orderId, int $itemCount): string;

    public function cancelOrderInPOS(string $orderId): void;

    public function updateOrderInPOS(string $orderId, array $items): void;

    public function getOrderStatusFromPOS(string $orderId): ?string;
}
