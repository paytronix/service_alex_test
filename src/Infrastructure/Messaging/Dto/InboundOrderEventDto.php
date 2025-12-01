<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Dto;

use App\Infrastructure\Messaging\Exception\NonRetryableException;

final class InboundOrderEventDto
{
    private string $eventType;
    private string $orderId;
    private array $payload;
    private string $occurredOn;
    private ?string $correlationId;
    private ?string $sourceSystem;

    private function __construct(
        string $eventType,
        string $orderId,
        array $payload,
        string $occurredOn,
        ?string $correlationId,
        ?string $sourceSystem
    ) {
        $this->eventType = $eventType;
        $this->orderId = $orderId;
        $this->payload = $payload;
        $this->occurredOn = $occurredOn;
        $this->correlationId = $correlationId;
        $this->sourceSystem = $sourceSystem;
    }

    public static function fromArray(array $data): self
    {
        self::validate($data);

        return new self(
            $data['event_type'],
            $data['order_id'],
            $data['payload'] ?? [],
            $data['occurred_on'],
            $data['correlation_id'] ?? null,
            $data['source_system'] ?? null
        );
    }

    public static function validate(array $data): void
    {
        $requiredFields = ['event_type', 'order_id', 'occurred_on'];

        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw NonRetryableException::validationFailed($field, 'Field is required');
            }
        }

        $validEventTypes = [
            'order.created',
            'order.submitted',
            'order.confirmed',
            'order.cancelled',
            'order.payment.completed',
            'order.payment.failed',
            'order.pos.received',
            'order.pos.completed',
            'order.restaurant.accepted',
            'order.restaurant.rejected',
        ];

        if (!in_array($data['event_type'], $validEventTypes, true)) {
            throw NonRetryableException::validationFailed(
                'event_type',
                sprintf('Invalid event type: %s', $data['event_type'])
            );
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $data['occurred_on'])) {
            throw NonRetryableException::validationFailed(
                'occurred_on',
                'Invalid datetime format, expected ISO 8601'
            );
        }
    }

    public function getEventType(): string
    {
        return $this->eventType;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function getPayload(): array
    {
        return $this->payload;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function getSourceSystem(): ?string
    {
        return $this->sourceSystem;
    }

    public function getPayloadValue(string $key, mixed $default = null): mixed
    {
        return $this->payload[$key] ?? $default;
    }

    public function toArray(): array
    {
        return [
            'event_type' => $this->eventType,
            'order_id' => $this->orderId,
            'payload' => $this->payload,
            'occurred_on' => $this->occurredOn,
            'correlation_id' => $this->correlationId,
            'source_system' => $this->sourceSystem,
        ];
    }

    public function generateMessageId(): string
    {
        return hash('sha256', sprintf('%s:%s:%s', $this->orderId, $this->eventType, $this->occurredOn));
    }
}
