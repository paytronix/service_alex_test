<?php

declare(strict_types=1);

namespace App\Application\Mapper;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Entity\OrderItem;
use App\Domain\ValueObject\Money;
use App\Presentation\Dto\CustomerResponse;
use App\Presentation\Dto\MoneyResponse;
use App\Presentation\Dto\OrderItemResponse;
use App\Presentation\Dto\OrderResponse;

final class OrderMapper
{
    public function toResponse(Order $order): OrderResponse
    {
        return new OrderResponse(
            id: $order->id()->value(),
            status: $order->status()->value(),
            customer: $this->mapCustomer($order->customer()),
            items: $this->mapItems($order->items()),
            totalAmount: $this->mapMoney($order->totalAmount()),
            notes: $order->notes(),
            cancellationReason: $order->cancellationReason(),
            createdAt: $order->createdAt()->format(),
            updatedAt: $order->updatedAt()->format(),
            submittedAt: $order->submittedAt()?->format(),
            cancelledAt: $order->cancelledAt()?->format(),
        );
    }

    public function toResponseArray(Order $order): array
    {
        $response = $this->toResponse($order);

        return [
            'id' => $response->id,
            'status' => $response->status,
            'customer' => [
                'email' => $response->customer->email,
                'first_name' => $response->customer->firstName,
                'last_name' => $response->customer->lastName,
                'phone' => $response->customer->phone,
                'company' => $response->customer->company,
                'address_line_1' => $response->customer->addressLine1,
                'address_line_2' => $response->customer->addressLine2,
                'city' => $response->customer->city,
                'state' => $response->customer->state,
                'postal_code' => $response->customer->postalCode,
                'country' => $response->customer->country,
            ],
            'items' => array_map(fn(OrderItemResponse $item) => [
                'id' => $item->id,
                'product_id' => $item->productId,
                'product_name' => $item->productName,
                'product_sku' => $item->productSku,
                'quantity' => $item->quantity,
                'unit_price' => [
                    'amount' => $item->unitPrice->amount,
                    'currency' => $item->unitPrice->currency,
                    'formatted' => $item->unitPrice->formatted,
                ],
                'total_price' => [
                    'amount' => $item->totalPrice->amount,
                    'currency' => $item->totalPrice->currency,
                    'formatted' => $item->totalPrice->formatted,
                ],
                'notes' => $item->notes,
            ], $response->items),
            'total_amount' => [
                'amount' => $response->totalAmount->amount,
                'currency' => $response->totalAmount->currency,
                'formatted' => $response->totalAmount->formatted,
            ],
            'notes' => $response->notes,
            'cancellation_reason' => $response->cancellationReason,
            'created_at' => $response->createdAt,
            'updated_at' => $response->updatedAt,
            'submitted_at' => $response->submittedAt,
            'cancelled_at' => $response->cancelledAt,
        ];
    }

    private function mapCustomer(OrderCustomer $customer): CustomerResponse
    {
        return new CustomerResponse(
            email: $customer->email(),
            firstName: $customer->firstName(),
            lastName: $customer->lastName(),
            phone: $customer->phone(),
            company: $customer->company(),
            addressLine1: $customer->addressLine1(),
            addressLine2: $customer->addressLine2(),
            city: $customer->city(),
            state: $customer->state(),
            postalCode: $customer->postalCode(),
            country: $customer->country(),
        );
    }

    private function mapItems(array $items): array
    {
        return array_map(fn(OrderItem $item) => $this->mapItem($item), $items);
    }

    private function mapItem(OrderItem $item): OrderItemResponse
    {
        return new OrderItemResponse(
            id: $item->id(),
            productId: $item->productId(),
            productName: $item->productName(),
            productSku: $item->productSku(),
            quantity: $item->quantity(),
            unitPrice: $this->mapMoney($item->unitPrice()),
            totalPrice: $this->mapMoney($item->totalPrice()),
            notes: $item->notes(),
        );
    }

    private function mapMoney(Money $money): MoneyResponse
    {
        return new MoneyResponse(
            amount: $money->amount(),
            currency: $money->currency(),
            formatted: $money->toFloat(),
        );
    }
}
