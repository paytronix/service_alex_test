<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Message;

final class InboundPaymentEvent
{
    private array $payload;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    public function getPayload(): array
    {
        return $this->payload;
    }

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}
