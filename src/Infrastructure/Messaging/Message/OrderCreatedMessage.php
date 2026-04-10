<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Message;

final class OrderCreatedMessage
{
    private string $orderId;
    private string $customerEmail;
    private string $occurredOn;

    public function __construct(string $orderId, string $customerEmail, string $occurredOn)
    {
        $this->orderId = $orderId;
        $this->customerEmail = $customerEmail;
        $this->occurredOn = $occurredOn;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function getCustomerEmail(): string
    {
        return $this->customerEmail;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId,
            'customer_email' => $this->customerEmail,
            'occurred_on' => $this->occurredOn,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['order_id'],
            $data['customer_email'],
            $data['occurred_on']
        );
    }
}
