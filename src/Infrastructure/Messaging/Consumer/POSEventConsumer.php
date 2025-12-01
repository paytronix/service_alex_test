<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Consumer;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\Messaging\Dto\InboundPOSEventDto;
use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Message\InboundPOSEvent;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\CorrelationIdService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsMessageHandler]
final class POSEventConsumer
{
    private MessageIdempotencyService $idempotencyService;
    private CircuitBreakerService $circuitBreaker;
    private CorrelationIdService $correlationIdService;
    private LoggerInterface $logger;
    private OrderRepositoryInterface $orderRepository;
    private MessageBusInterface $messageBus;

    private const MESSAGE_TYPE = 'pos_event';
    private const SERVICE_NAME = 'pos_service';

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

    public function __invoke(InboundPOSEvent $message): void
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

        $this->logger->info('Processing POS event message', $context);

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

            $this->logger->info('POS event message processed successfully', $context);
        } catch (NonRetryableException $e) {
            $this->logger->error('Non-retryable error processing POS event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            $this->logger->warning('Retryable error processing POS event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error processing POS event', array_merge($context, [
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
        InboundPOSEventDto::validate($message);
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
        $dto = InboundPOSEventDto::fromArray($payload);

        $this->logger->info('Processing POS event', [
            'event_type' => $dto->getEventType(),
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
            'status' => $dto->getStatus(),
            'correlation_id' => $dto->getCorrelationId(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            throw NonRetryableException::resourceNotFound('Order', $dto->getOrderId());
        }

        switch ($dto->getEventType()) {
            case 'pos.order.received':
                $this->handlePOSOrderReceived($dto);
                break;

            case 'pos.order.processing':
                $this->handlePOSOrderProcessing($dto, $order);
                break;

            case 'pos.order.completed':
                $this->handlePOSOrderCompleted($dto, $order);
                break;

            case 'pos.order.failed':
                $this->handlePOSOrderFailed($dto, $order);
                break;

            case 'pos.order.cancelled':
                $this->handlePOSOrderCancelled($dto, $order);
                break;

            default:
                $this->logger->info('Unhandled POS event type', [
                    'event_type' => $dto->getEventType(),
                    'order_id' => $dto->getOrderId(),
                ]);
        }
    }

    private function handlePOSOrderReceived(InboundPOSEventDto $dto): void
    {
        $this->logger->info('POS order received', [
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
            'terminal_id' => $dto->getTerminalId(),
        ]);
    }

    private function handlePOSOrderProcessing(InboundPOSEventDto $dto, Order $order): void
    {
        $this->logger->info('POS order processing', [
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
        ]);

        $currentStatus = $order->status()->value();

        if ($currentStatus === 'confirmed') {
            try {
                $order->startProcessing();
                $this->orderRepository->save($order);

                $this->logger->info('Order moved to processing', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->warning('Could not move order to processing', [
                    'order_id' => $dto->getOrderId(),
                    'current_status' => $currentStatus,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function handlePOSOrderCompleted(InboundPOSEventDto $dto, Order $order): void
    {
        $this->logger->info('POS order completed', [
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
        ]);

        $currentStatus = $order->status()->value();

        if (in_array($currentStatus, ['confirmed', 'processing'], true)) {
            try {
                if ($currentStatus === 'confirmed') {
                    $order->startProcessing();
                }
                $order->ship();
                $this->orderRepository->save($order);

                $this->logger->info('Order marked as shipped after POS completion', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to update order after POS completion', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
                throw RetryableException::fromException($e, 'Failed to update order');
            }
        }
    }

    private function handlePOSOrderFailed(InboundPOSEventDto $dto, Order $order): void
    {
        $this->logger->warning('POS order failed', [
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
            'error_code' => $dto->getErrorCode(),
            'error_message' => $dto->getErrorMessage(),
        ]);

        if ($order->canBeCancelled()) {
            try {
                $reason = sprintf(
                    'POS processing failed: %s (Code: %s)',
                    $dto->getErrorMessage() ?? 'Unknown error',
                    $dto->getErrorCode() ?? 'N/A'
                );
                $order->cancel($reason);
                $this->orderRepository->save($order);

                $this->logger->info('Order cancelled due to POS failure', [
                    'order_id' => $dto->getOrderId(),
                    'reason' => $reason,
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to cancel order after POS failure', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function handlePOSOrderCancelled(InboundPOSEventDto $dto, Order $order): void
    {
        $this->logger->info('POS order cancelled', [
            'order_id' => $dto->getOrderId(),
            'pos_order_id' => $dto->getPosOrderId(),
        ]);

        if ($order->canBeCancelled()) {
            try {
                $order->cancel('Cancelled by POS system');
                $this->orderRepository->save($order);

                $this->logger->info('Order cancelled after POS cancellation', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->warning('Could not cancel order after POS cancellation', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
