<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use Psr\Log\LoggerInterface;

final class StubRestaurantServiceClient implements RestaurantServiceClientInterface
{
    private LoggerInterface $logger;
    private bool $isAvailable;
    private array $notifiedOrders = [];

    public function __construct(LoggerInterface $logger, bool $isAvailable = true)
    {
        $this->logger = $logger;
        $this->isAvailable = $isAvailable;
    }

    public function notifyOrderCreated(string $orderId, string $customerEmail): void
    {
        $this->logger->info('StubRestaurantServiceClient: notifyOrderCreated', [
            'order_id' => $orderId,
            'customer_email' => $customerEmail,
        ]);

        $this->notifiedOrders[$orderId] = [
            'type' => 'created',
            'customer_email' => $customerEmail,
            'notified_at' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        ];
    }

    public function notifyOrderCancelled(string $orderId, string $reason): void
    {
        $this->logger->info('StubRestaurantServiceClient: notifyOrderCancelled', [
            'order_id' => $orderId,
            'reason' => $reason,
        ]);

        $this->notifiedOrders[$orderId] = [
            'type' => 'cancelled',
            'reason' => $reason,
            'notified_at' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        ];
    }

    public function checkRestaurantAvailability(string $restaurantId): bool
    {
        $this->logger->info('StubRestaurantServiceClient: checkRestaurantAvailability', [
            'restaurant_id' => $restaurantId,
            'is_available' => $this->isAvailable,
        ]);

        return $this->isAvailable;
    }

    public function getRestaurantDetails(string $restaurantId): ?array
    {
        $this->logger->info('StubRestaurantServiceClient: getRestaurantDetails', [
            'restaurant_id' => $restaurantId,
        ]);

        return [
            'id' => $restaurantId,
            'name' => 'Stub Restaurant',
            'address' => '123 Stub Street',
            'is_open' => $this->isAvailable,
        ];
    }

    public function getNotifiedOrders(): array
    {
        return $this->notifiedOrders;
    }

    public function setAvailability(bool $isAvailable): void
    {
        $this->isAvailable = $isAvailable;
    }

    public function reset(): void
    {
        $this->notifiedOrders = [];
    }
}
