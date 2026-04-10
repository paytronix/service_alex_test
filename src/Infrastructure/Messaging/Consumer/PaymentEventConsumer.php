<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Consumer;

use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\Messaging\Dto\InboundPaymentEventDto;
use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Message\InboundPaymentEvent;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\CorrelationIdService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsMessageHandler]
final class PaymentEventConsumer
{
    private MessageIdempotencyService $idempotencyService;
    private CircuitBreakerService $circuitBreaker;
    private CorrelationIdService $correlationIdService;
    private LoggerInterface $logger;
    private OrderRepositoryInterface $orderRepository;
    private MessageBusInterface $messageBus;

    private const MESSAGE_TYPE = 'payment_event';
    private const SERVICE_NAME = 'payment_service';

    public function __construct(
        MessageIdempotencyService $idempotencyService,
        CircuitBreakerService $circuitBreaker,
        CorrelationIdService $correlationIdService,
        LoggerInterface $logger,
        OrderRepositoryInterface $orderRepository,
        MessageBusInterface $messageBus
    ) {
        $this->idempotencyService = $idempotencyService;
        $this->circuitBreaker = $circuitBreaker;
        $this->correlationIdService = $correlationIdService;
        $this->logger = $logger;
        $this->orderRepository = $orderRepository;
        $this->messageBus = $messageBus;
    }

    public function __invoke(InboundPaymentEvent $message): void
    {
        $payload = $message->getPayload();
        $messageId = $this->extractMessageId($payload);
        $correlationId = $payload['correlation_id'] ?? null;

        if ($correlationId) {
            $this->correlationIdService->set($correlationId);
        } else {
            $correlationId = $this->correlationIdService->generate();
        }

        $context = [
            'message_id' => $messageId,
            'message_type' => self::MESSAGE_TYPE,
            'correlation_id' => $correlationId,
        ];

        $this->logger->info('Processing payment event message', $context);

        try {
            $this->validateMessage($payload);

            if ($this->idempotencyService->isProcessed($messageId, self::MESSAGE_TYPE)) {
                $this->logger->info('Message already processed, skipping', $context);
                return;
            }

            if (!$this->circuitBreaker->isAvailable(self::SERVICE_NAME)) {
                $this->logger->warning('Circuit breaker is open, message will be retried', $context);
                throw RetryableException::serviceUnavailable(self::SERVICE_NAME);
            }

            $this->processPayload($payload);

            $this->idempotencyService->markAsProcessed($messageId, self::MESSAGE_TYPE);
            $this->circuitBreaker->recordSuccess(self::SERVICE_NAME);

            $this->logger->info('Payment event message processed successfully', $context);
        } catch (NonRetryableException $e) {
            $this->logger->error('Non-retryable error processing payment event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            $this->logger->warning('Retryable error processing payment event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error processing payment event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw RetryableException::fromException($e, 'Unexpected error');
        } finally {
            $this->correlationIdService->clear();
        }
    }

    private function validateMessage(array $message): void
    {
        if (empty($message)) {
            throw NonRetryableException::invalidMessage('Message payload is empty');
        }
        InboundPaymentEventDto::validate($message);
    }

    private function extractMessageId(array $message): string
    {
        if (isset($message['message_id'])) {
            return $message['message_id'];
        }

        $orderId = $message['order_id'] ?? 'unknown';
        $eventType = $message['event_type'] ?? self::MESSAGE_TYPE;
        $occurredOn = $message['occurred_on'] ?? (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP');

        return hash('sha256', sprintf('%s:%s:%s', $orderId, $eventType, $occurredOn));
    }

    private function processPayload(array $payload): void
    {
        $dto = InboundPaymentEventDto::fromArray($payload);

        $this->logger->info('Processing payment event', [
            'event_type' => $dto->getEventType(),
            'order_id' => $dto->getOrderId(),
            'payment_id' => $dto->getPaymentId(),
            'status' => $dto->getStatus(),
            'correlation_id' => $dto->getCorrelationId(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            throw NonRetryableException::resourceNotFound('Order', $dto->getOrderId());
        }

        switch ($dto->getEventType()) {
            case 'payment.completed':
                $this->handlePaymentCompleted($dto, $order);
                break;

            case 'payment.failed':
                $this->handlePaymentFailed($dto, $order);
                break;

            case 'payment.refunded':
                $this->handlePaymentRefunded($dto, $order);
                break;

            case 'payment.cancelled':
                $this->handlePaymentCancelled($dto);
                break;

            default:
                $this->logger->info('Unhandled payment event type', [
                    'event_type' => $dto->getEventType(),
                    'order_id' => $dto->getOrderId(),
                ]);
        }
    }

    private function handlePaymentCompleted(InboundPaymentEventDto $dto, \App\Domain\Entity\Order $order): void
    {
        $this->logger->info('Payment completed', [
            'order_id' => $dto->getOrderId(),
            'payment_id' => $dto->getPaymentId(),
            'amount' => $dto->getAmount(),
            'currency' => $dto->getCurrency(),
        ]);

        if ($order->status()->value() === 'submitted') {
            try {
                $order->confirm();
                $this->orderRepository->save($order);

                $this->logger->info('Order confirmed after payment', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to confirm order after payment', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
                throw RetryableException::fromException($e, 'Failed to confirm order');
            }
        }
    }

    private function handlePaymentFailed(InboundPaymentEventDto $dto, \App\Domain\Entity\Order $order): void
    {
        $this->logger->warning('Payment failed', [
            'order_id' => $dto->getOrderId(),
            'payment_id' => $dto->getPaymentId(),
            'failure_reason' => $dto->getFailureReason(),
        ]);

        if ($order->canBeCancelled()) {
            try {
                $reason = sprintf('Payment failed: %s', $dto->getFailureReason() ?? 'Unknown reason');
                $order->cancel($reason);
                $this->orderRepository->save($order);

                $this->logger->info('Order cancelled due to payment failure', [
                    'order_id' => $dto->getOrderId(),
                    'reason' => $reason,
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to cancel order after payment failure', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function handlePaymentRefunded(InboundPaymentEventDto $dto, \App\Domain\Entity\Order $order): void
    {
        $this->logger->info('Payment refunded', [
            'order_id' => $dto->getOrderId(),
            'payment_id' => $dto->getPaymentId(),
            'amount' => $dto->getAmount(),
        ]);

        try {
            $order->refund();
            $this->orderRepository->save($order);

            $this->logger->info('Order marked as refunded', [
                'order_id' => $dto->getOrderId(),
            ]);
        } catch (\Throwable $e) {
            $this->logger->warning('Could not mark order as refunded', [
                'order_id' => $dto->getOrderId(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handlePaymentCancelled(InboundPaymentEventDto $dto): void
    {
        $this->logger->info('Payment cancelled', [
            'order_id' => $dto->getOrderId(),
            'payment_id' => $dto->getPaymentId(),
        ]);
    }
}
