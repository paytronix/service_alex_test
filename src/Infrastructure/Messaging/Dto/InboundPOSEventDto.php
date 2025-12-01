<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Dto;

use App\Infrastructure\Messaging\Exception\NonRetryableException;

final class InboundPOSEventDto
{
    private string $eventType;
    private string $orderId;
    private string $posOrderId;
    private string $status;
    private ?string $terminalId;
    private ?string $errorCode;
    private ?string $errorMessage;
    private string $occurredOn;
    private ?string $correlationId;

    private function __construct(
        string $eventType,
        string $orderId,
        string $posOrderId,
        string $status,
        ?string $terminalId,
        ?string $errorCode,
        ?string $errorMessage,
        string $occurredOn,
        ?string $correlationId
    ) {
        $this->eventType = $eventType;
        $this->orderId = $orderId;
        $this->posOrderId = $posOrderId;
        $this->status = $status;
        $this->terminalId = $terminalId;
        $this->errorCode = $errorCode;
        $this->errorMessage = $errorMessage;
        $this->occurredOn = $occurredOn;
        $this->correlationId = $correlationId;
    }

    public static function fromArray(array $data): self
    {
        self::validate($data);

        return new self(
            $data['event_type'],
            $data['order_id'],
            $data['pos_order_id'],
            $data['status'],
            $data['terminal_id'] ?? null,
            $data['error_code'] ?? null,
            $data['error_message'] ?? null,
            $data['occurred_on'],
            $data['correlation_id'] ?? null
        );
    }

    public static function validate(array $data): void
    {
        $requiredFields = ['event_type', 'order_id', 'pos_order_id', 'status', 'occurred_on'];

        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw NonRetryableException::validationFailed($field, 'Field is required');
            }
        }

        $validEventTypes = [
            'pos.order.received',
            'pos.order.processing',
            'pos.order.completed',
            'pos.order.failed',
            'pos.order.cancelled',
        ];

        if (!in_array($data['event_type'], $validEventTypes, true)) {
            throw NonRetryableException::validationFailed(
                'event_type',
                sprintf('Invalid POS event type: %s', $data['event_type'])
            );
        }

        $validStatuses = ['received', 'processing', 'completed', 'failed', 'cancelled'];

        if (!in_array($data['status'], $validStatuses, true)) {
            throw NonRetryableException::validationFailed(
                'status',
                sprintf('Invalid POS status: %s', $data['status'])
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

    public function getPosOrderId(): string
    {
        return $this->posOrderId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getTerminalId(): ?string
    {
        return $this->terminalId;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function getOccurredOn(): string
    {
        return $this->occurredOn;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function isSuccessful(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function toArray(): array
    {
        return [
            'event_type' => $this->eventType,
            'order_id' => $this->orderId,
            'pos_order_id' => $this->posOrderId,
            'status' => $this->status,
            'terminal_id' => $this->terminalId,
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
            'occurred_on' => $this->occurredOn,
            'correlation_id' => $this->correlationId,
        ];
    }

    public function generateMessageId(): string
    {
        return hash('sha256', sprintf('%s:%s:%s:%s', $this->orderId, $this->posOrderId, $this->eventType, $this->occurredOn));
    }
}
