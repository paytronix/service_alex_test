<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Domain\ValueObject\Timestamp;
use App\Infrastructure\Messaging\Consumer\PaymentEventConsumer;
use App\Infrastructure\Messaging\Consumer\POSEventConsumer;
use App\Infrastructure\Messaging\Consumer\RestaurantEventConsumer;
use App\Infrastructure\Messaging\Exception\NonRetryableException;
use App\Infrastructure\Messaging\Exception\RetryableException;
use App\Infrastructure\Messaging\Service\CircuitBreakerService;
use App\Infrastructure\Messaging\Service\MessageIdempotencyService;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class ConsumerIntegrationTest extends KernelTestCase
{
    private OrderRepositoryInterface $orderRepository;
    private MessageIdempotencyService $idempotencyService;
    private CircuitBreakerService $circuitBreaker;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->orderRepository = $container->get(OrderRepositoryInterface::class);
        $this->idempotencyService = $container->get(MessageIdempotencyService::class);
        $this->circuitBreaker = $container->get(CircuitBreakerService::class);
    }

    public function testPaymentCompletedEventConfirmsOrder(): void
    {
        $order = $this->createSubmittedOrder('payment-test-order-1');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $message = [
            'event_type' => 'payment.completed',
            'order_id' => $order->id()->value(),
            'payment_id' => 'payment-123',
            'status' => 'completed',
            'amount' => '50.00',
            'currency' => 'USD',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('confirmed', $updatedOrder->status()->value());
    }

    public function testPaymentFailedEventCancelsOrder(): void
    {
        $order = $this->createSubmittedOrder('payment-test-order-2');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $message = [
            'event_type' => 'payment.failed',
            'order_id' => $order->id()->value(),
            'payment_id' => 'payment-456',
            'status' => 'failed',
            'failure_reason' => 'Insufficient funds',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('cancelled', $updatedOrder->status()->value());
    }

    public function testPOSCompletedEventShipsOrder(): void
    {
        $order = $this->createConfirmedOrder('pos-test-order-1');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(POSEventConsumer::class);

        $message = [
            'event_type' => 'pos.order.completed',
            'order_id' => $order->id()->value(),
            'pos_order_id' => 'pos-123',
            'status' => 'completed',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('shipped', $updatedOrder->status()->value());
    }

    public function testPOSFailedEventCancelsOrder(): void
    {
        $order = $this->createConfirmedOrder('pos-test-order-2');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(POSEventConsumer::class);

        $message = [
            'event_type' => 'pos.order.failed',
            'order_id' => $order->id()->value(),
            'pos_order_id' => 'pos-456',
            'status' => 'failed',
            'error_code' => 'POS_ERROR',
            'error_message' => 'Terminal offline',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('cancelled', $updatedOrder->status()->value());
    }

    public function testRestaurantAcceptedEventStartsProcessing(): void
    {
        $order = $this->createConfirmedOrder('restaurant-test-order-1');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(RestaurantEventConsumer::class);

        $message = [
            'event_type' => 'restaurant.order.accepted',
            'order_id' => $order->id()->value(),
            'restaurant_id' => 'restaurant-123',
            'status' => 'accepted',
            'estimated_prep_time_minutes' => 30,
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('processing', $updatedOrder->status()->value());
    }

    public function testRestaurantRejectedEventCancelsOrder(): void
    {
        $order = $this->createConfirmedOrder('restaurant-test-order-2');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(RestaurantEventConsumer::class);

        $message = [
            'event_type' => 'restaurant.order.rejected',
            'order_id' => $order->id()->value(),
            'restaurant_id' => 'restaurant-456',
            'status' => 'rejected',
            'rejection_reason' => 'Kitchen closed',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('cancelled', $updatedOrder->status()->value());
    }

    public function testIdempotencyPreventsDoubleProcessing(): void
    {
        $order = $this->createSubmittedOrder('idempotency-test-order');
        $this->orderRepository->save($order);

        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $occurredOn = (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP');
        $message = [
            'event_type' => 'payment.completed',
            'order_id' => $order->id()->value(),
            'payment_id' => 'payment-idempotent',
            'status' => 'completed',
            'amount' => '50.00',
            'currency' => 'USD',
            'occurred_on' => $occurredOn,
        ];

        $consumer($message);
        $consumer($message);

        $updatedOrder = $this->orderRepository->findById($order->id());
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('confirmed', $updatedOrder->status()->value());
    }

    public function testNonExistentOrderThrowsNonRetryableException(): void
    {
        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $message = [
            'event_type' => 'payment.completed',
            'order_id' => 'non-existent-order-id',
            'payment_id' => 'payment-789',
            'status' => 'completed',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $this->expectException(NonRetryableException::class);
        $consumer($message);
    }

    public function testInvalidMessageThrowsNonRetryableException(): void
    {
        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $message = [
            'event_type' => 'invalid.event.type',
            'order_id' => 'some-order-id',
            'payment_id' => 'payment-invalid',
            'status' => 'completed',
            'occurred_on' => (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP'),
        ];

        $this->expectException(NonRetryableException::class);
        $consumer($message);
    }

    public function testEmptyMessageThrowsNonRetryableException(): void
    {
        $consumer = static::getContainer()->get(PaymentEventConsumer::class);

        $this->expectException(NonRetryableException::class);
        $consumer([]);
    }

    private function createSubmittedOrder(string $orderId): Order
    {
        $customer = OrderCustomer::create(
            'test@example.com',
            'Test',
            'Customer'
        );

        $now = Timestamp::now();

        $order = Order::reconstitute(
            OrderId::fromString($orderId),
            $customer,
            OrderStatus::draft(),
            [],
            Money::zero('USD'),
            null,
            null,
            $now,
            $now,
            null,
            null
        );

        $order->addItem(
            'product-1',
            'Test Product',
            2,
            Money::fromFloat(25.00, 'USD'),
            'SKU-001',
            null
        );

        $order->submit();

        return $order;
    }

    private function createConfirmedOrder(string $orderId): Order
    {
        $order = $this->createSubmittedOrder($orderId);
        $order->confirm();
        return $order;
    }
}
