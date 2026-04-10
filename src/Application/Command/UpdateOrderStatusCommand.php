<?php

declare(strict_types=1);

namespace App\Application\Command;

final readonly class UpdateOrderStatusCommand
{
    public function __construct(
        public string $orderId,
        public string $newStatus,
        public ?string $reason = null,
    ) {
    }
}
