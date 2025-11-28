<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\Timestamp;

final class OrderSubmittedEvent implements DomainEvent
{
    private OrderId $orderId;
    private Money $totalAmount;
    private int $itemCount;
    private Timestamp $occurredOn;

    public function __construct(OrderId $orderId, Money $totalAmount, int $itemCount, Timestamp $occurredOn)
    {
        $this->orderId = $orderId;
        $this->totalAmount = $totalAmount;
        $this->itemCount = $itemCount;
        $this->occurredOn = $occurredOn;
    }

    public function orderId(): OrderId
    {
        return $this->orderId;
    }

    public function totalAmount(): Money
    {
        return $this->totalAmount;
    }

    public function itemCount(): int
    {
        return $this->itemCount;
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
        return 'order.submitted';
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId->value(),
            'total_amount' => $this->totalAmount->amount(),
            'total_currency' => $this->totalAmount->currency(),
            'item_count' => $this->itemCount,
            'occurred_on' => $this->occurredOn->format(),
        ];
    }
}
