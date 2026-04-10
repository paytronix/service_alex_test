<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class IdempotencyAndCircuitBreakerTest extends KernelTestCase
{
    private MessageIdempotencyService $idempotencyService;
    private CircuitBreakerService $circuitBreaker;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->idempotencyService = $container->get(MessageIdempotencyService::class);
        $this->circuitBreaker = $container->get(CircuitBreakerService::class);
    }

    public function testIdempotencyServiceMarksMessageAsProcessed(): void
    {
        $messageId = 'test-message-' . uniqid();
        $messageType = 'test_event';

        $this->assertFalse($this->idempotencyService->isProcessed($messageId, $messageType));

        $this->idempotencyService->markAsProcessed($messageId, $messageType);

        $this->assertTrue($this->idempotencyService->isProcessed($messageId, $messageType));
    }

    public function testIdempotencyServiceRemovesProcessedMark(): void
    {
        $messageId = 'test-message-remove-' . uniqid();
        $messageType = 'test_event';

        $this->idempotencyService->markAsProcessed($messageId, $messageType);
        $this->assertTrue($this->idempotencyService->isProcessed($messageId, $messageType));

        $this->idempotencyService->removeProcessedMark($messageId, $messageType);
        $this->assertFalse($this->idempotencyService->isProcessed($messageId, $messageType));
    }

    public function testIdempotencyServiceGeneratesConsistentMessageId(): void
    {
        $aggregateId = 'order-123';
        $eventType = 'order.created';
        $occurredOn = '2024-01-15T10:30:00.000000+00:00';

        $messageId1 = $this->idempotencyService->generateMessageId($aggregateId, $eventType, $occurredOn);
        $messageId2 = $this->idempotencyService->generateMessageId($aggregateId, $eventType, $occurredOn);

        $this->assertEquals($messageId1, $messageId2);
    }

    public function testIdempotencyServiceGeneratesDifferentIdsForDifferentEvents(): void
    {
        $aggregateId = 'order-123';
        $occurredOn = '2024-01-15T10:30:00.000000+00:00';

        $messageId1 = $this->idempotencyService->generateMessageId($aggregateId, 'order.created', $occurredOn);
        $messageId2 = $this->idempotencyService->generateMessageId($aggregateId, 'order.submitted', $occurredOn);

        $this->assertNotEquals($messageId1, $messageId2);
    }

    public function testCircuitBreakerStartsClosed(): void
    {
        $serviceName = 'test-service-' . uniqid();

        $this->assertTrue($this->circuitBreaker->isAvailable($serviceName));

        $state = $this->circuitBreaker->getState($serviceName);
        $this->assertEquals('closed', $state['state']);
    }

    public function testCircuitBreakerOpensAfterFailures(): void
    {
        $serviceName = 'test-service-failures-' . uniqid();

        for ($i = 0; $i < 5; $i++) {
            $this->circuitBreaker->recordFailure($serviceName, new \RuntimeException('Test failure'));
        }

        $this->assertFalse($this->circuitBreaker->isAvailable($serviceName));

        $state = $this->circuitBreaker->getState($serviceName);
        $this->assertEquals('open', $state['state']);
    }

    public function testCircuitBreakerResetsOnSuccess(): void
    {
        $serviceName = 'test-service-reset-' . uniqid();

        for ($i = 0; $i < 3; $i++) {
            $this->circuitBreaker->recordFailure($serviceName, new \RuntimeException('Test failure'));
        }

        $this->circuitBreaker->recordSuccess($serviceName);

        $state = $this->circuitBreaker->getState($serviceName);
        $this->assertEquals('closed', $state['state']);
        $this->assertEquals(0, $state['failure_count']);
    }

    public function testCircuitBreakerCanBeManuallyReset(): void
    {
        $serviceName = 'test-service-manual-reset-' . uniqid();

        for ($i = 0; $i < 5; $i++) {
            $this->circuitBreaker->recordFailure($serviceName, new \RuntimeException('Test failure'));
        }

        $this->assertFalse($this->circuitBreaker->isAvailable($serviceName));

        $this->circuitBreaker->reset($serviceName);

        $this->assertTrue($this->circuitBreaker->isAvailable($serviceName));

        $state = $this->circuitBreaker->getState($serviceName);
        $this->assertEquals('closed', $state['state']);
    }

    public function testCircuitBreakerTracksFailureCount(): void
    {
        $serviceName = 'test-service-count-' . uniqid();

        $this->circuitBreaker->recordFailure($serviceName, new \RuntimeException('Test failure 1'));
        $this->circuitBreaker->recordFailure($serviceName, new \RuntimeException('Test failure 2'));

        $state = $this->circuitBreaker->getState($serviceName);
        $this->assertEquals(2, $state['failure_count']);
        $this->assertEquals('closed', $state['state']);
    }

    public function testMultipleServicesAreTrackedIndependently(): void
    {
        $service1 = 'test-service-independent-1-' . uniqid();
        $service2 = 'test-service-independent-2-' . uniqid();

        for ($i = 0; $i < 5; $i++) {
            $this->circuitBreaker->recordFailure($service1, new \RuntimeException('Test failure'));
        }

        $this->assertFalse($this->circuitBreaker->isAvailable($service1));
        $this->assertTrue($this->circuitBreaker->isAvailable($service2));
    }

    public function testIdempotencyWithDifferentMessageTypes(): void
    {
        $messageId = 'shared-message-id-' . uniqid();

        $this->idempotencyService->markAsProcessed($messageId, 'type_a');

        $this->assertTrue($this->idempotencyService->isProcessed($messageId, 'type_a'));
        $this->assertFalse($this->idempotencyService->isProcessed($messageId, 'type_b'));
    }
}
