<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Dto;

use App\Infrastructure\Messaging\Exception\NonRetryableException;

final class InboundPaymentEventDto
{
    private string $eventType;
    private string $orderId;
    private string $paymentId;
    private string $status;
    private ?string $amount;
    private ?string $currency;
    private ?string $failureReason;
    private string $occurredOn;
    private ?string $correlationId;

    private function __construct(
        string $eventType,
        string $orderId,
        string $paymentId,
        string $status,
        ?string $amount,
        ?string $currency,
        ?string $failureReason,
        string $occurredOn,
        ?string $correlationId
    ) {
        $this->eventType = $eventType;
        $this->orderId = $orderId;
        $this->paymentId = $paymentId;
        $this->status = $status;
        $this->amount = $amount;
        $this->currency = $currency;
        $this->failureReason = $failureReason;
        $this->occurredOn = $occurredOn;
        $this->correlationId = $correlationId;
    }

    public static function fromArray(array $data): self
    {
        self::validate($data);

        return new self(
            $data['event_type'],
            $data['order_id'],
            $data['payment_id'],
            $data['status'],
            $data['amount'] ?? null,
            $data['currency'] ?? null,
            $data['failure_reason'] ?? null,
            $data['occurred_on'],
            $data['correlation_id'] ?? null
        );
    }

    public static function validate(array $data): void
    {
        $requiredFields = ['event_type', 'order_id', 'payment_id', 'status', 'occurred_on'];

        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw NonRetryableException::validationFailed($field, 'Field is required');
            }
        }

        $validEventTypes = [
            'payment.initiated',
            'payment.completed',
            'payment.failed',
            'payment.refunded',
            'payment.cancelled',
        ];

        if (!in_array($data['event_type'], $validEventTypes, true)) {
            throw NonRetryableException::validationFailed(
                'event_type',
                sprintf('Invalid payment event type: %s', $data['event_type'])
            );
        }

        $validStatuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];

        if (!in_array($data['status'], $validStatuses, true)) {
            throw NonRetryableException::validationFailed(
                'status',
                sprintf('Invalid payment status: %s', $data['status'])
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

    public function getPaymentId(): string
    {
        return $this->paymentId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getAmount(): ?string
    {
        return $this->amount;
    }

    public function getCurrency(): ?string
    {
        return $this->currency;
    }

    public function getFailureReason(): ?string
    {
        return $this->failureReason;
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
            'payment_id' => $this->paymentId,
            'status' => $this->status,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'failure_reason' => $this->failureReason,
            'occurred_on' => $this->occurredOn,
            'correlation_id' => $this->correlationId,
        ];
    }

    public function generateMessageId(): string
    {
        return hash('sha256', sprintf('%s:%s:%s:%s', $this->orderId, $this->paymentId, $this->eventType, $this->occurredOn));
    }
}
