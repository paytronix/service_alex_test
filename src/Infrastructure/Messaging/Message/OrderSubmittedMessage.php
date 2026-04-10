<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Message;

final class OrderSubmittedMessage
{
    private string $orderId;
    private string $totalAmount;
    private string $totalCurrency;
    private int $itemCount;
    private string $occurredOn;

    public function __construct(
        string $orderId,
        string $totalAmount,
        string $totalCurrency,
        int $itemCount,
        string $occurredOn
    ) {
        $this->orderId = $orderId;
        $this->totalAmount = $totalAmount;
        $this->totalCurrency = $totalCurrency;
        $this->itemCount = $itemCount;
        $this->occurredOn = $occurredOn;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function getTotalAmount(): string
    {
        return $this->totalAmount;
    }

    public function getTotalCurrency(): string
    {
        return $this->totalCurrency;
    }

    public function getItemCount(): int
    {
        return $this->itemCount;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId,
            'total_amount' => $this->totalAmount,
            'total_currency' => $this->totalCurrency,
            'item_count' => $this->itemCount,
            'occurred_on' => $this->occurredOn,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['order_id'],
            $data['total_amount'],
            $data['total_currency'],
            $data['item_count'],
            $data['occurred_on']
        );
    }
}
