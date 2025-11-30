<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Message;

final class OrderCancelledMessage
{
    private string $orderId;
    private string $reason;
    private string $occurredOn;

    public function __construct(string $orderId, string $reason, string $occurredOn)
    {
        $this->orderId = $orderId;
        $this->reason = $reason;
        $this->occurredOn = $occurredOn;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function getReason(): string
    {
        return $this->reason;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId,
            'reason' => $this->reason,
            'occurred_on' => $this->occurredOn,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['order_id'],
            $data['reason'],
            $data['occurred_on']
        );
    }
}
