<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

final class OrderItemResponse
{
    public function __construct(
        public readonly string $id,
        public readonly string $productId,
        public readonly string $productName,
        public readonly ?string $productSku,
        public readonly int $quantity,
        public readonly int $unitPriceAmount,
        public readonly string $unitPriceCurrency,
        public readonly int $totalPriceAmount,
        public readonly string $totalPriceCurrency,
        public readonly ?string $notes,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'product_sku' => $this->productSku,
            'quantity' => $this->quantity,
            'unit_price_amount' => $this->unitPriceAmount,
            'unit_price_currency' => $this->unitPriceCurrency,
            'total_price_amount' => $this->totalPriceAmount,
            'total_price_currency' => $this->totalPriceCurrency,
            'notes' => $this->notes,
        ];
    }
}
