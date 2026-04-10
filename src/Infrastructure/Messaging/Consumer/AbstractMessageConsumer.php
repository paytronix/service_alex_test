<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\Consumer;

use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\CorrelationIdService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Psr\Log\LoggerInterface;

abstract class AbstractMessageConsumer
{
    protected MessageIdempotencyService $idempotencyService;
    protected CircuitBreakerService $circuitBreaker;
    protected CorrelationIdService $correlationIdService;
    protected LoggerInterface $logger;

    public function __construct(
        MessageIdempotencyService $idempotencyService,
        CircuitBreakerService $circuitBreaker,
        CorrelationIdService $correlationIdService,
        LoggerInterface $logger
    ) {
        $this->idempotencyService = $idempotencyService;
        $this->circuitBreaker = $circuitBreaker;
        $this->correlationIdService = $correlationIdService;
        $this->logger = $logger;
    }

    abstract protected function getMessageType(): string;

    abstract protected function processMessage(array $payload): void;

    public function __invoke(array $message): void
    {
        $messageId = $this->extractMessageId($message);
        $correlationId = $message['correlation_id'] ?? null;

        if ($correlationId) {
            $this->correlationIdService->set($correlationId);
        } else {
            $correlationId = $this->correlationIdService->generate();
        }

        $context = [
            'message_id' => $messageId,
            'message_type' => $this->getMessageType(),
            'correlation_id' => $correlationId,
        ];

        $this->logger->info('Processing message', $context);

        try {
            $this->validateMessage($message);

            if ($this->idempotencyService->isProcessed($messageId, $this->getMessageType())) {
                $this->logger->info('Message already processed, skipping', $context);
                return;
            }

            $serviceName = $this->getServiceName();
            if (!$this->circuitBreaker->isAvailable($serviceName)) {
                $this->logger->warning('Circuit breaker is open, message will be retried', $context);
                throw RetryableException::serviceUnavailable($serviceName);
            }

            $this->processMessage($message);

            $this->idempotencyService->markAsProcessed($messageId, $this->getMessageType());
            $this->circuitBreaker->recordSuccess($serviceName);

            $this->logger->info('Message processed successfully', $context);
        } catch (NonRetryableException $e) {
            $this->logger->error('Non-retryable error processing message', array_merge($context, [
                'error' => $e->getMessage(),
                'exception_class' => get_class($e),
            ]));
            throw $e;
        } catch (RetryableException $e) {
            $this->circuitBreaker->recordFailure($this->getServiceName(), $e);
            $this->logger->warning('Retryable error processing message', array_merge($context, [
                'error' => $e->getMessage(),
                'exception_class' => get_class($e),
            ]));
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error processing message', array_merge($context, [
                'error' => $e->getMessage(),
                'exception_class' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]));
            throw RetryableException::fromException($e, 'Unexpected error');
        } finally {
            $this->correlationIdService->clear();
        }
    }

    protected function validateMessage(array $message): void
    {
        if (empty($message)) {
            throw NonRetryableException::invalidMessage('Message payload is empty');
        }
    }

    protected function extractMessageId(array $message): string
    {
        if (isset($message['message_id'])) {
            return $message['message_id'];
        }

        $orderId = $message['order_id'] ?? 'unknown';
        $eventType = $message['event_type'] ?? $this->getMessageType();
        $occurredOn = $message['occurred_on'] ?? (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP');

        return hash('sha256', sprintf('%s:%s:%s', $orderId, $eventType, $occurredOn));
    }

    protected function getServiceName(): string
    {
        return $this->getMessageType();
    }
}
