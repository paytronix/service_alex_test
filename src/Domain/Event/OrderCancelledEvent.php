<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\Timestamp;

final class OrderCancelledEvent implements DomainEvent
{
    private OrderId $orderId;
    private string $reason;
    private Timestamp $occurredOn;

    public function __construct(OrderId $orderId, string $reason, Timestamp $occurredOn)
    {
        $this->orderId = $orderId;
        $this->reason = $reason;
        $this->occurredOn = $occurredOn;
    }

    public function orderId(): OrderId
    {
        return $this->orderId;
    }

    public function reason(): string
    {
        return $this->reason;
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
        return 'order.cancelled';
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId->value(),
            'reason' => $this->reason,
            'occurred_on' => $this->occurredOn->format(),
        ];
    }
}
