<?php

declare(strict_types=1);

namespace App\Presentation\Dto;

final readonly class OrderResponse
{
    public function __construct(
        public string $id,
        public string $status,
        public CustomerResponse $customer,
        public array $items,
        public MoneyResponse $totalAmount,
        public ?string $notes,
        public ?string $cancellationReason,
        public string $createdAt,
        public string $updatedAt,
        public ?string $submittedAt,
        public ?string $cancelledAt,
    ) {
    }
}
