<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\ValueObject\Timestamp;

interface DomainEvent
{
    public function occurredOn(): Timestamp;

    public function aggregateId(): string;

    public function eventName(): string;

    public function toArray(): array;
}
