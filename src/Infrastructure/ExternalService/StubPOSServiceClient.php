<?php

declare(strict_types=1);

namespace App\Infrastructure\ExternalService;

use Psr\Log\LoggerInterface;

final class StubPOSServiceClient implements POSServiceClientInterface
{
    private LoggerInterface $logger;
    private array $orders = [];
    private bool $shouldFail = false;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    public function sendOrderToPOS(string $orderId, int $itemCount): string
    {
        $this->logger->info('StubPOSServiceClient: sendOrderToPOS', [
            'order_id' => $orderId,
            'item_count' => $itemCount,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('POS service unavailable');
        }

        $posOrderId = 'POS-' . uniqid();
        $this->orders[$orderId] = [
            'pos_order_id' => $posOrderId,
            'item_count' => $itemCount,
            'status' => 'sent',
            'sent_at' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        ];

        return $posOrderId;
    }

    public function cancelOrderInPOS(string $orderId): void
    {
        $this->logger->info('StubPOSServiceClient: cancelOrderInPOS', [
            'order_id' => $orderId,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('POS service unavailable');
        }

        if (isset($this->orders[$orderId])) {
            $this->orders[$orderId]['status'] = 'cancelled';
            $this->orders[$orderId]['cancelled_at'] = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        }
    }

    public function updateOrderInPOS(string $orderId, array $items): void
    {
        $this->logger->info('StubPOSServiceClient: updateOrderInPOS', [
            'order_id' => $orderId,
            'items' => $items,
        ]);

        if ($this->shouldFail) {
            throw new \RuntimeException('POS service unavailable');
        }

        if (isset($this->orders[$orderId])) {
            $this->orders[$orderId]['items'] = $items;
            $this->orders[$orderId]['item_count'] = count($items);
            $this->orders[$orderId]['updated_at'] = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        }
    }

    public function getOrderStatusFromPOS(string $orderId): ?string
    {
        $this->logger->info('StubPOSServiceClient: getOrderStatusFromPOS', [
            'order_id' => $orderId,
        ]);

        return $this->orders[$orderId]['status'] ?? null;
    }

    public function getOrders(): array
    {
        return $this->orders;
    }

    public function setShouldFail(bool $shouldFail): void
    {
        $this->shouldFail = $shouldFail;
    }

    public function reset(): void
    {
        $this->orders = [];
        $this->shouldFail = false;
    }
}
