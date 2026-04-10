<?php

declare(strict_types=1);

namespace App\Interface\Http\Mapper;

use App\Domain\Entity\OrderItem;
use App\Interface\Http\Dto\OrderItemResponse;

final class OrderItemMapper
{
    public function toOrderItemResponse(OrderItem $item): OrderItemResponse
    {
        return new OrderItemResponse(
            id: $item->id(),
            productId: $item->productId(),
            productName: $item->productName(),
            productSku: $item->productSku(),
            quantity: $item->quantity(),
            unitPriceAmount: $item->unitPrice()->amount(),
            unitPriceCurrency: $item->unitPrice()->currency(),
            totalPriceAmount: $item->totalPrice()->amount(),
            totalPriceCurrency: $item->totalPrice()->currency(),
            notes: $item->notes(),
        );
    }

    public function toOrderItemResponseArray(array $items): array
    {
        return array_map(
            fn(OrderItem $item) => $this->toOrderItemResponse($item),
            $items
        );
    }
}
