<?php

declare(strict_types=1);

namespace App\Application\Event;

use DateTimeImmutable;

final readonly class OrderStatusUpdatedEvent
{
    public function __construct(
        public string $orderId,
        public string $previousStatus,
        public string $newStatus,
        public ?string $reason,
        public DateTimeImmutable $occurredOn,
    ) {
    }
}
