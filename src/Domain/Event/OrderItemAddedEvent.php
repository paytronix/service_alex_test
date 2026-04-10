<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\Timestamp;

final class OrderItemAddedEvent implements DomainEvent
{
    private OrderId $orderId;
    private string $productId;
    private string $productName;
    private int $quantity;
    private Money $unitPrice;
    private Timestamp $occurredOn;

    public function __construct(
        OrderId $orderId,
        string $productId,
        string $productName,
        int $quantity,
        Money $unitPrice,
        Timestamp $occurredOn
    ) {
        $this->orderId = $orderId;
        $this->productId = $productId;
        $this->productName = $productName;
        $this->quantity = $quantity;
        $this->unitPrice = $unitPrice;
        $this->occurredOn = $occurredOn;
    }

    public function orderId(): OrderId
    {
        return $this->orderId;
    }

    public function productId(): string
    {
        return $this->productId;
    }

    public function productName(): string
    {
        return $this->productName;
    }

    public function quantity(): int
    {
        return $this->quantity;
    }

    public function unitPrice(): Money
    {
        return $this->unitPrice;
    }

    public function occurredOn(): Timestamp
    {
        return $this->occurredOn;
    }

    public function aggregateId(): string
    {
        return $this->orderId->value();
    }

    public function eventName(): string
    {
        return 'order.item_added';
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId->value(),
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'quantity' => $this->quantity,
            'unit_price' => $this->unitPrice->amount(),
            'unit_currency' => $this->unitPrice->currency(),
            'occurred_on' => $this->occurredOn->format(),
        ];
    }
}
