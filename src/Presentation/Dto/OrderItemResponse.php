<?php

declare(strict_types=1);

namespace App\Presentation\Dto;

final readonly class OrderItemResponse
{
    public function __construct(
        public string $id,
        public string $productId,
        public string $productName,
        public ?string $productSku,
        public int $quantity,
        public MoneyResponse $unitPrice,
        public MoneyResponse $totalPrice,
        public ?string $notes,
    ) {
    }
}
