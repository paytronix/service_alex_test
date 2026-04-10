<?php

declare(strict_types=1);

namespace App\Application\Event;

use App\Domain\ValueObject\OrderId;
use DateTimeImmutable;

final readonly class OrderCreatedEvent
{
    public function __construct(
        public string $orderId,
        public string $customerEmail,
        public DateTimeImmutable $occurredOn,
    ) {
    }

    public static function fromDomainEvent(\App\Domain\Event\OrderCreatedEvent $domainEvent): self
    {
        return new self(
            $domainEvent->orderId()->value(),
            $domainEvent->customerEmail(),
            $domainEvent->occurredOn()->value(),
        );
    }
}
