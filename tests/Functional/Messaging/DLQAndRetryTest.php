<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\RetryPolicyService;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class DLQAndRetryTest extends KernelTestCase
{
    private RetryPolicyService $retryPolicyService;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->retryPolicyService = $container->get(RetryPolicyService::class);
    }

    public function testRetryPolicyAllowsRetryForRetryableException(): void
    {
        $exception = new RetryableException('Temporary failure');

        $this->assertTrue($this->retryPolicyService->shouldRetry($exception, 1));
        $this->assertTrue($this->retryPolicyService->shouldRetry($exception, 2));
    }

    public function testRetryPolicyDeniesRetryForNonRetryableException(): void
    {
        $exception = new NonRetryableException('Permanent failure');

        $this->assertFalse($this->retryPolicyService->shouldRetry($exception, 1));
    }

    public function testRetryPolicyDeniesRetryAfterMaxRetries(): void
    {
        $exception = new RetryableException('Temporary failure');
        $maxRetries = $this->retryPolicyService->getMaxRetries();

        $this->assertFalse($this->retryPolicyService->shouldRetry($exception, $maxRetries));
        $this->assertFalse($this->retryPolicyService->shouldRetry($exception, $maxRetries + 1));
    }

    public function testRetryPolicyCalculatesExponentialDelay(): void
    {
        $delay1 = $this->retryPolicyService->calculateDelay(1);
        $delay2 = $this->retryPolicyService->calculateDelay(2);
        $delay3 = $this->retryPolicyService->calculateDelay(3);

        $this->assertGreaterThan(0, $delay1);
        $this->assertGreaterThan($delay1, $delay2);
        $this->assertGreaterThan($delay2, $delay3);
    }

    public function testRetryPolicyDelayHasJitter(): void
    {
        $delays = [];
        for ($i = 0; $i < 10; $i++) {
            $delays[] = $this->retryPolicyService->calculateDelay(1);
        }

        $uniqueDelays = array_unique($delays);
        $this->assertGreaterThan(1, count($uniqueDelays), 'Delays should have jitter');
    }

    public function testRetryPolicyWrapsRetryableException(): void
    {
        $originalException = new \RuntimeException('Original error');
        $wrapped = $this->retryPolicyService->wrapRetryable($originalException, 'Context');

        $this->assertInstanceOf(RetryableException::class, $wrapped);
        $this->assertStringContainsString('Context', $wrapped->getMessage());
        $this->assertStringContainsString('Original error', $wrapped->getMessage());
        $this->assertSame($originalException, $wrapped->getPrevious());
    }

    public function testRetryPolicyWrapsNonRetryableException(): void
    {
        $originalException = new \RuntimeException('Original error');
        $wrapped = $this->retryPolicyService->wrapNonRetryable($originalException, 'Context');

        $this->assertInstanceOf(NonRetryableException::class, $wrapped);
        $this->assertStringContainsString('Context', $wrapped->getMessage());
        $this->assertStringContainsString('Original error', $wrapped->getMessage());
        $this->assertSame($originalException, $wrapped->getPrevious());
    }

    public function testRetryableExceptionFactoryMethods(): void
    {
        $serviceUnavailable = RetryableException::serviceUnavailable('TestService');
        $this->assertStringContainsString('TestService', $serviceUnavailable->getMessage());
        $this->assertEquals(503, $serviceUnavailable->getCode());

        $timeout = RetryableException::timeout('TestOperation');
        $this->assertStringContainsString('TestOperation', $timeout->getMessage());
        $this->assertEquals(504, $timeout->getCode());

        $connectionFailed = RetryableException::connectionFailed('TestTarget');
        $this->assertStringContainsString('TestTarget', $connectionFailed->getMessage());
        $this->assertEquals(503, $connectionFailed->getCode());
    }

    public function testNonRetryableExceptionFactoryMethods(): void
    {
        $invalidMessage = NonRetryableException::invalidMessage('Bad format');
        $this->assertStringContainsString('Bad format', $invalidMessage->getMessage());
        $this->assertEquals(400, $invalidMessage->getCode());

        $validationFailed = NonRetryableException::validationFailed('email', 'Invalid format');
        $this->assertStringContainsString('email', $validationFailed->getMessage());
        $this->assertStringContainsString('Invalid format', $validationFailed->getMessage());
        $this->assertEquals(422, $validationFailed->getCode());

        $businessRule = NonRetryableException::businessRuleViolation('Cannot cancel delivered order');
        $this->assertStringContainsString('Cannot cancel delivered order', $businessRule->getMessage());
        $this->assertEquals(422, $businessRule->getCode());

        $notFound = NonRetryableException::resourceNotFound('Order', 'order-123');
        $this->assertStringContainsString('Order', $notFound->getMessage());
        $this->assertStringContainsString('order-123', $notFound->getMessage());
        $this->assertEquals(404, $notFound->getCode());

        $duplicate = NonRetryableException::duplicateMessage('msg-123');
        $this->assertStringContainsString('msg-123', $duplicate->getMessage());
        $this->assertEquals(409, $duplicate->getCode());
    }

    public function testExceptionCorrelationId(): void
    {
        $exception = new RetryableException('Test');
        $exception->withCorrelationId('corr-123');

        $this->assertEquals('corr-123', $exception->getCorrelationId());
    }

    public function testExceptionContext(): void
    {
        $exception = new RetryableException('Test');
        $context = ['key' => 'value', 'number' => 42];
        $exception->withContext($context);

        $this->assertEquals($context, $exception->getContext());
    }

    public function testRetryPolicyDetectsTransientExceptions(): void
    {
        $transientExceptions = [
            new \RuntimeException('Connection refused'),
            new \RuntimeException('Request timeout'),
            new \RuntimeException('Service temporarily unavailable'),
            new \RuntimeException('Too many requests'),
            new \RuntimeException('Network error'),
        ];

        foreach ($transientExceptions as $exception) {
            $this->assertTrue(
                $this->retryPolicyService->shouldRetry($exception, 1),
                sprintf('Expected transient exception "%s" to be retryable', $exception->getMessage())
            );
        }
    }

    public function testRetryPolicyDoesNotRetryNonTransientExceptions(): void
    {
        $nonTransientExceptions = [
            new \RuntimeException('Invalid input'),
            new \RuntimeException('Resource not found'),
            new \RuntimeException('Permission denied'),
        ];

        foreach ($nonTransientExceptions as $exception) {
            $this->assertFalse(
                $this->retryPolicyService->shouldRetry($exception, 1),
                sprintf('Expected non-transient exception "%s" to not be retryable', $exception->getMessage())
            );
        }
    }

    public function testMaxRetriesConfiguration(): void
    {
        $maxRetries = $this->retryPolicyService->getMaxRetries();

        $this->assertGreaterThan(0, $maxRetries);
        $this->assertLessThanOrEqual(10, $maxRetries);
    }
}
