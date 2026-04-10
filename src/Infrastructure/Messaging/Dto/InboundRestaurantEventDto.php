<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Dto;

use App\Infrastructure\Messaging\Exception\NonRetryableException;

final class InboundRestaurantEventDto
{
    private string $eventType;
    private string $orderId;
    private string $restaurantId;
    private string $status;
    private ?int $estimatedPrepTimeMinutes;
    private ?string $rejectionReason;
    private string $occurredOn;
    private ?string $correlationId;

    private function __construct(
        string $eventType,
        string $orderId,
        string $restaurantId,
        string $status,
        ?int $estimatedPrepTimeMinutes,
        ?string $rejectionReason,
        string $occurredOn,
        ?string $correlationId
    ) {
        $this->eventType = $eventType;
        $this->orderId = $orderId;
        $this->restaurantId = $restaurantId;
        $this->status = $status;
        $this->estimatedPrepTimeMinutes = $estimatedPrepTimeMinutes;
        $this->rejectionReason = $rejectionReason;
        $this->occurredOn = $occurredOn;
        $this->correlationId = $correlationId;
    }

    public static function fromArray(array $data): self
    {
        self::validate($data);

        return new self(
            $data['event_type'],
            $data['order_id'],
            $data['restaurant_id'],
            $data['status'],
            isset($data['estimated_prep_time_minutes']) ? (int) $data['estimated_prep_time_minutes'] : null,
            $data['rejection_reason'] ?? null,
            $data['occurred_on'],
            $data['correlation_id'] ?? null
        );
    }

    public static function validate(array $data): void
    {
        $requiredFields = ['event_type', 'order_id', 'restaurant_id', 'status', 'occurred_on'];

        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw NonRetryableException::validationFailed($field, 'Field is required');
            }
        }

        $validEventTypes = [
            'restaurant.order.received',
            'restaurant.order.accepted',
            'restaurant.order.rejected',
            'restaurant.order.preparing',
            'restaurant.order.ready',
            'restaurant.order.cancelled',
        ];

        if (!in_array($data['event_type'], $validEventTypes, true)) {
            throw NonRetryableException::validationFailed(
                'event_type',
                sprintf('Invalid restaurant event type: %s', $data['event_type'])
            );
        }

        $validStatuses = ['received', 'accepted', 'rejected', 'preparing', 'ready', 'cancelled'];

        if (!in_array($data['status'], $validStatuses, true)) {
            throw NonRetryableException::validationFailed(
                'status',
                sprintf('Invalid restaurant status: %s', $data['status'])
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

    public function getRestaurantId(): string
    {
        return $this->restaurantId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getEstimatedPrepTimeMinutes(): ?int
    {
        return $this->estimatedPrepTimeMinutes;
    }

    public function getRejectionReason(): ?string
    {
        return $this->rejectionReason;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public function toArray(): array
    {
        return [
            'event_type' => $this->eventType,
            'order_id' => $this->orderId,
            'restaurant_id' => $this->restaurantId,
            'status' => $this->status,
            'estimated_prep_time_minutes' => $this->estimatedPrepTimeMinutes,
            'rejection_reason' => $this->rejectionReason,
            'occurred_on' => $this->occurredOn,
            'correlation_id' => $this->correlationId,
        ];
    }

    public function generateMessageId(): string
    {
        return hash('sha256', sprintf('%s:%s:%s:%s', $this->orderId, $this->restaurantId, $this->eventType, $this->occurredOn));
    }
}
