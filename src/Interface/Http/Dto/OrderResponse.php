<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

final class OrderResponse
{
    public function __construct(
        public readonly string $id,
        public readonly string $status,
        public readonly OrderCustomerResponse $customer,
        public readonly array $items,
        public readonly int $totalAmount,
        public readonly string $totalCurrency,
        public readonly ?string $notes,
        public readonly ?string $cancellationReason,
        public readonly string $createdAt,
        public readonly string $updatedAt,
        public readonly ?string $submittedAt,
        public readonly ?string $cancelledAt,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'customer' => $this->customer->toArray(),
            'items' => array_map(fn(OrderItemResponse $item) => $item->toArray(), $this->items),
            'total_amount' => $this->totalAmount,
            'total_currency' => $this->totalCurrency,
            'notes' => $this->notes,
            'cancellation_reason' => $this->cancellationReason,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'submitted_at' => $this->submittedAt,
            'cancelled_at' => $this->cancelledAt,
        ];
    }
}
