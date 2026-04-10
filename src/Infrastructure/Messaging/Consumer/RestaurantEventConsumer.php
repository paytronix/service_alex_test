<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Consumer;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\Messaging\Dto\InboundRestaurantEventDto;
use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Message\InboundRestaurantEvent;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\CorrelationIdService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsMessageHandler]
final class RestaurantEventConsumer
{
    private MessageIdempotencyService $idempotencyService;
    private CircuitBreakerService $circuitBreaker;
    private CorrelationIdService $correlationIdService;
    private LoggerInterface $logger;
    private OrderRepositoryInterface $orderRepository;
    private MessageBusInterface $messageBus;

    private const MESSAGE_TYPE = 'restaurant_event';
    private const SERVICE_NAME = 'restaurant_service';

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

    public function __invoke(InboundRestaurantEvent $message): void
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

        $this->logger->info('Processing restaurant event message', $context);

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

            $this->logger->info('Restaurant event message processed successfully', $context);
        } catch (NonRetryableException $e) {
            $this->logger->error('Non-retryable error processing restaurant event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure(self::SERVICE_NAME, $e);
            $this->logger->warning('Retryable error processing restaurant event', array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error processing restaurant event', array_merge($context, [
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
        InboundRestaurantEventDto::validate($message);
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
        $dto = InboundRestaurantEventDto::fromArray($payload);

        $this->logger->info('Processing restaurant event', [
            'event_type' => $dto->getEventType(),
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
            'status' => $dto->getStatus(),
            'correlation_id' => $dto->getCorrelationId(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            throw NonRetryableException::resourceNotFound('Order', $dto->getOrderId());
        }

        switch ($dto->getEventType()) {
            case 'restaurant.order.received':
                $this->handleRestaurantOrderReceived($dto);
                break;

            case 'restaurant.order.accepted':
                $this->handleRestaurantOrderAccepted($dto);
                break;

            case 'restaurant.order.rejected':
                $this->handleRestaurantOrderRejected($dto);
                break;

            case 'restaurant.order.preparing':
                $this->handleRestaurantOrderPreparing($dto);
                break;

            case 'restaurant.order.ready':
                $this->handleRestaurantOrderReady($dto);
                break;

            case 'restaurant.order.cancelled':
                $this->handleRestaurantOrderCancelled($dto);
                break;

            default:
                $this->logger->info('Unhandled restaurant event type', [
                    'event_type' => $dto->getEventType(),
                    'order_id' => $dto->getOrderId(),
                ]);
        }
    }

    private function handleRestaurantOrderReceived(InboundRestaurantEventDto $dto): void
    {
        $this->logger->info('Restaurant received order', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
        ]);
    }

    private function handleRestaurantOrderAccepted(InboundRestaurantEventDto $dto): void
    {
        $this->logger->info('Restaurant accepted order', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
            'estimated_prep_time_minutes' => $dto->getEstimatedPrepTimeMinutes(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            return;
        }

        $currentStatus = $order->status()->value();

        if ($currentStatus === 'confirmed') {
            try {
                $order->startProcessing();
                $this->orderRepository->save($order);

                $this->logger->info('Order moved to processing after restaurant acceptance', [
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

    private function handleRestaurantOrderRejected(InboundRestaurantEventDto $dto): void
    {
        $this->logger->warning('Restaurant rejected order', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
            'rejection_reason' => $dto->getRejectionReason(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            return;
        }

        if ($order->canBeCancelled()) {
            try {
                $reason = sprintf(
                    'Restaurant rejected order: %s',
                    $dto->getRejectionReason() ?? 'No reason provided'
                );
                $order->cancel($reason);
                $this->orderRepository->save($order);

                $this->logger->info('Order cancelled due to restaurant rejection', [
                    'order_id' => $dto->getOrderId(),
                    'reason' => $reason,
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to cancel order after restaurant rejection', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
                throw RetryableException::fromException($e, 'Failed to cancel order');
            }
        }
    }

    private function handleRestaurantOrderPreparing(InboundRestaurantEventDto $dto): void
    {
        $this->logger->info('Restaurant preparing order', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
        ]);
    }

    private function handleRestaurantOrderReady(InboundRestaurantEventDto $dto): void
    {
        $this->logger->info('Restaurant order ready', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            return;
        }

        $currentStatus = $order->status()->value();

        if ($currentStatus === 'processing') {
            try {
                $order->ship();
                $this->orderRepository->save($order);

                $this->logger->info('Order marked as shipped after restaurant ready', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->error('Failed to ship order after restaurant ready', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
                throw RetryableException::fromException($e, 'Failed to ship order');
            }
        }
    }

    private function handleRestaurantOrderCancelled(InboundRestaurantEventDto $dto): void
    {
        $this->logger->info('Restaurant cancelled order', [
            'order_id' => $dto->getOrderId(),
            'restaurant_id' => $dto->getRestaurantId(),
        ]);

        $order = $this->orderRepository->findById(OrderId::fromString($dto->getOrderId()));

        if ($order === null) {
            return;
        }

        if ($order->canBeCancelled()) {
            try {
                $order->cancel('Cancelled by restaurant');
                $this->orderRepository->save($order);

                $this->logger->info('Order cancelled after restaurant cancellation', [
                    'order_id' => $dto->getOrderId(),
                ]);
            } catch (\Throwable $e) {
                $this->logger->warning('Could not cancel order after restaurant cancellation', [
                    'order_id' => $dto->getOrderId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
