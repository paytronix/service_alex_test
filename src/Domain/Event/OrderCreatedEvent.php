<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\Timestamp;

final class OrderCreatedEvent implements DomainEvent
{
    private OrderId $orderId;
    private string $customerEmail;
    private Timestamp $occurredOn;

    public function __construct(OrderId $orderId, string $customerEmail, Timestamp $occurredOn)
    {
        $this->orderId = $orderId;
        $this->customerEmail = $customerEmail;
        $this->occurredOn = $occurredOn;
    }

    public function orderId(): OrderId
    {
        return $this->orderId;
    }

    public function customerEmail(): string
    {
        return $this->customerEmail;
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
        return 'order.created';
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId->value(),
            'customer_email' => $this->customerEmail,
            'occurred_on' => $this->occurredOn->format(),
        ];
    }
}
