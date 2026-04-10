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
use App\Infrastructure\ExternalService\StubPaymentServiceClient;
use App\Infrastructure\ExternalService\StubPOSServiceClient;
use App\Infrastructure\ExternalService\StubRestaurantServiceClient;
use App\Infrastructure\Messaging\Message\OrderCancelledMessage;
use App\Infrastructure\Messaging\Message\OrderCreatedMessage;
use App\Infrastructure\Messaging\Message\OrderSubmittedMessage;
use App\Infrastructure\Messaging\MessageHandler\OrderCancelledMessageHandler;
use App\Infrastructure\Messaging\MessageHandler\OrderCreatedMessageHandler;
use App\Infrastructure\Messaging\MessageHandler\OrderSubmittedMessageHandler;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Transport\InMemory\InMemoryTransport;

final class OrderMessageTest extends KernelTestCase
{
    private OrderRepositoryInterface $orderRepository;
    private MessageBusInterface $messageBus;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->orderRepository = $container->get(OrderRepositoryInterface::class);
        $this->messageBus = $container->get(MessageBusInterface::class);
    }

    public function testOrderCreatedMessageIsDispatchedToAsyncTransport(): void
    {
        $container = static::getContainer();
        $transport = $container->get('messenger.transport.async');

        $message = new OrderCreatedMessage(
            'test-order-id-1',
            'test@example.com',
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $this->messageBus->dispatch($message);

        $this->assertInstanceOf(InMemoryTransport::class, $transport);
        $envelopes = $transport->getSent();
        $this->assertCount(1, $envelopes);
        $this->assertInstanceOf(OrderCreatedMessage::class, $envelopes[0]->getMessage());
    }

    public function testOrderSubmittedMessageIsDispatchedToPriorityTransport(): void
    {
        $container = static::getContainer();
        $transport = $container->get('messenger.transport.async_priority_high');

        $message = new OrderSubmittedMessage(
            'test-order-id-2',
            '100.00',
            'USD',
            3,
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $this->messageBus->dispatch($message);

        $this->assertInstanceOf(InMemoryTransport::class, $transport);
        $envelopes = $transport->getSent();
        $this->assertCount(1, $envelopes);
        $this->assertInstanceOf(OrderSubmittedMessage::class, $envelopes[0]->getMessage());
    }

    public function testOrderCancelledMessageIsDispatchedToPriorityTransport(): void
    {
        $container = static::getContainer();
        $transport = $container->get('messenger.transport.async_priority_high');

        $message = new OrderCancelledMessage(
            'test-order-id-3',
            'Customer requested cancellation',
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $this->messageBus->dispatch($message);

        $this->assertInstanceOf(InMemoryTransport::class, $transport);
        $envelopes = $transport->getSent();
        $this->assertCount(1, $envelopes);
        $this->assertInstanceOf(OrderCancelledMessage::class, $envelopes[0]->getMessage());
    }

    public function testOrderCreatedMessageHandlerProcessesMessage(): void
    {
        $container = static::getContainer();

        $order = $this->createTestOrder('handler-test-order-1');
        $this->orderRepository->save($order);

        $handler = $container->get(OrderCreatedMessageHandler::class);
        $message = new OrderCreatedMessage(
            $order->id()->value(),
            'handler-test@example.com',
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $handler($message);

        $restaurantClient = $container->get(StubRestaurantServiceClient::class);
        $notifiedOrders = $restaurantClient->getNotifiedOrders();
        $this->assertArrayHasKey($order->id()->value(), $notifiedOrders);
        $this->assertEquals('created', $notifiedOrders[$order->id()->value()]['type']);
    }

    public function testOrderSubmittedMessageHandlerProcessesMessage(): void
    {
        $container = static::getContainer();

        $order = $this->createTestOrder('handler-test-order-2');
        $order->addItem(
            'product-1',
            'Test Product',
            2,
            Money::fromFloat(25.00, 'USD'),
            'SKU-001',
            null
        );
        $order->submit();
        $this->orderRepository->save($order);

        $handler = $container->get(OrderSubmittedMessageHandler::class);
        $message = new OrderSubmittedMessage(
            $order->id()->value(),
            '50.00',
            'USD',
            1,
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $handler($message);

        $paymentClient = $container->get(StubPaymentServiceClient::class);
        $payments = $paymentClient->getPayments();
        $this->assertArrayHasKey($order->id()->value(), $payments);
        $this->assertEquals('initiated', $payments[$order->id()->value()]['status']);

        $posClient = $container->get(StubPOSServiceClient::class);
        $posOrders = $posClient->getOrders();
        $this->assertArrayHasKey($order->id()->value(), $posOrders);
        $this->assertEquals('sent', $posOrders[$order->id()->value()]['status']);
    }

    public function testOrderCancelledMessageHandlerProcessesMessage(): void
    {
        $container = static::getContainer();

        $order = $this->createTestOrder('handler-test-order-3');
        $order->cancel('Test cancellation reason');
        $this->orderRepository->save($order);

        $handler = $container->get(OrderCancelledMessageHandler::class);
        $message = new OrderCancelledMessage(
            $order->id()->value(),
            'Test cancellation reason',
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $handler($message);

        $paymentClient = $container->get(StubPaymentServiceClient::class);
        $payments = $paymentClient->getPayments();

        $posClient = $container->get(StubPOSServiceClient::class);
        $posOrders = $posClient->getOrders();

        $restaurantClient = $container->get(StubRestaurantServiceClient::class);
        $notifiedOrders = $restaurantClient->getNotifiedOrders();
        $this->assertArrayHasKey($order->id()->value(), $notifiedOrders);
        $this->assertEquals('cancelled', $notifiedOrders[$order->id()->value()]['type']);
    }

    public function testIdempotencyPreventsDoubleProcessing(): void
    {
        $container = static::getContainer();

        $order = $this->createTestOrder('idempotency-test-order');
        $this->orderRepository->save($order);

        $handler = $container->get(OrderCreatedMessageHandler::class);
        $occurredOn = (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP');
        $message = new OrderCreatedMessage(
            $order->id()->value(),
            'idempotency-test@example.com',
            $occurredOn
        );

        $handler($message);
        $handler($message);

        $restaurantClient = $container->get(StubRestaurantServiceClient::class);
        $notifiedOrders = $restaurantClient->getNotifiedOrders();
        $this->assertCount(1, array_filter($notifiedOrders, function ($notification) use ($order) {
            return true;
        }));
    }

    public function testHandlerSkipsNonExistentOrder(): void
    {
        $container = static::getContainer();

        $handler = $container->get(OrderCreatedMessageHandler::class);
        $message = new OrderCreatedMessage(
            'non-existent-order-id',
            'test@example.com',
            (new \DateTimeImmutable())->format('Y-m-d\TH:i:s.uP')
        );

        $handler($message);

        $restaurantClient = $container->get(StubRestaurantServiceClient::class);
        $notifiedOrders = $restaurantClient->getNotifiedOrders();
        $this->assertArrayNotHasKey('non-existent-order-id', $notifiedOrders);
    }

    public function testMessageSerialization(): void
    {
        $message = new OrderCreatedMessage(
            'serialization-test-order',
            'serialization@example.com',
            '2024-01-15T10:30:00.000000+00:00'
        );

        $array = $message->toArray();
        $restored = OrderCreatedMessage::fromArray($array);

        $this->assertEquals($message->getOrderId(), $restored->getOrderId());
        $this->assertEquals($message->getCustomerEmail(), $restored->getCustomerEmail());
        $this->assertEquals($message->getOccurredOn(), $restored->getOccurredOn());
    }

    public function testOrderSubmittedMessageSerialization(): void
    {
        $message = new OrderSubmittedMessage(
            'serialization-test-order-2',
            '150.00',
            'EUR',
            5,
            '2024-01-15T10:30:00.000000+00:00'
        );

        $array = $message->toArray();
        $restored = OrderSubmittedMessage::fromArray($array);

        $this->assertEquals($message->getOrderId(), $restored->getOrderId());
        $this->assertEquals($message->getTotalAmount(), $restored->getTotalAmount());
        $this->assertEquals($message->getTotalCurrency(), $restored->getTotalCurrency());
        $this->assertEquals($message->getItemCount(), $restored->getItemCount());
        $this->assertEquals($message->getOccurredOn(), $restored->getOccurredOn());
    }

    public function testOrderCancelledMessageSerialization(): void
    {
        $message = new OrderCancelledMessage(
            'serialization-test-order-3',
            'Customer changed mind',
            '2024-01-15T10:30:00.000000+00:00'
        );

        $array = $message->toArray();
        $restored = OrderCancelledMessage::fromArray($array);

        $this->assertEquals($message->getOrderId(), $restored->getOrderId());
        $this->assertEquals($message->getReason(), $restored->getReason());
        $this->assertEquals($message->getOccurredOn(), $restored->getOccurredOn());
    }

    private function createTestOrder(string $orderId): Order
    {
        $customer = OrderCustomer::create(
            'test@example.com',
            'Test',
            'Customer'
        );

        $now = Timestamp::now();

        return Order::reconstitute(
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
    }
}
