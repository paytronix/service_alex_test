<?php

declare(strict_types=1);

namespace App\Interface\Http\Mapper;

use App\Domain\Entity\Order;
use App\Interface\Http\Dto\OrderResponse;

final class OrderMapper
{
    public function __construct(
        private readonly OrderCustomerMapper $customerMapper,
        private readonly OrderItemMapper $itemMapper,
    ) {
    }

    public function toOrderResponse(Order $order): OrderResponse
    {
        return new OrderResponse(
            id: $order->id()->value(),
            status: $order->status()->value(),
            customer: $this->customerMapper->toOrderCustomerResponse($order->customer()),
            items: $this->itemMapper->toOrderItemResponseArray($order->items()),
            totalAmount: $order->totalAmount()->amount(),
            totalCurrency: $order->totalAmount()->currency(),
            notes: $order->notes(),
            cancellationReason: $order->cancellationReason(),
            createdAt: $order->createdAt()->format(),
            updatedAt: $order->updatedAt()->format(),
            submittedAt: $order->submittedAt()?->format(),
            cancelledAt: $order->cancelledAt()?->format(),
        );
    }

    public function toOrderResponseArray(array $orders): array
    {
        return array_map(
            fn(Order $order) => $this->toOrderResponse($order),
            $orders
        );
    }
}
