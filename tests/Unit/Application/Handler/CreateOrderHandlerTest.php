<?php

declare(strict_types=1);

namespace App\Tests\Unit\Application\Handler;

use App\Application\Command\CreateOrderCommand;
use App\Application\Command\Handler\CreateOrderHandler;
use App\Application\Event\OrderCreatedEvent;
use App\Application\Exception\OrderValidationException;
use App\Application\Service\OrderValidationServiceInterface;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateOrderHandlerTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $orderRepository;
    private OrderValidationServiceInterface&MockObject $validationService;
    private EventDispatcherInterface&MockObject $eventDispatcher;
    private MessageBusInterface&MockObject $messageBus;
    private CreateOrderHandler $handler;

    protected function setUp(): void
    {
        $this->orderRepository = $this->createMock(OrderRepositoryInterface::class);
        $this->validationService = $this->createMock(OrderValidationServiceInterface::class);
        $this->eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->messageBus = $this->createMock(MessageBusInterface::class);

        $this->handler = new CreateOrderHandler(
            $this->orderRepository,
            $this->validationService,
            $this->eventDispatcher,
            $this->messageBus,
        );
    }

    public function testInvokeCreatesOrderSuccessfully(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'John',
            customerLastName: 'Doe',
            customerPhone: '+1234567890',
            currency: 'USD',
            notes: 'Test order',
            items: [
                [
                    'product_id' => 'prod-1',
                    'product_name' => 'Test Product',
                    'quantity' => 2,
                    'unit_price' => 1000,
                ],
            ],
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate')
            ->with($this->callback(function (array $payload) {
                return $payload['customer_email'] === 'test@example.com'
                    && $payload['customer_first_name'] === 'John'
                    && $payload['customer_last_name'] === 'Doe';
            }));

        $this->orderRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Order $order) {
                return $order->customer()->email() === 'test@example.com'
                    && $order->customer()->firstName() === 'John'
                    && $order->customer()->lastName() === 'Doe'
                    && $order->itemCount() === 1
                    && $order->notes() === 'Test order';
            }));

        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(OrderCreatedEvent::class));

        $result = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $result);
    }

    public function testInvokeCreatesOrderWithoutItems(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'Jane',
            customerLastName: 'Smith',
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate');

        $this->orderRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Order $order) {
                return $order->isEmpty();
            }));

        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch');

        $result = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $result);
    }

    public function testInvokeCreatesOrderWithMultipleItems(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'John',
            customerLastName: 'Doe',
            currency: 'USD',
            items: [
                [
                    'product_id' => 'prod-1',
                    'product_name' => 'Product 1',
                    'quantity' => 1,
                    'unit_price' => 500,
                ],
                [
                    'product_id' => 'prod-2',
                    'product_name' => 'Product 2',
                    'quantity' => 3,
                    'unit_price' => 1500,
                ],
            ],
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate');

        $this->orderRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Order $order) {
                return $order->itemCount() === 2
                    && $order->totalAmount()->amount() === 5000;
            }));

        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch');

        $result = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $result);
    }

    public function testInvokeThrowsExceptionOnValidationFailure(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'invalid-email',
            customerFirstName: 'John',
            customerLastName: 'Doe',
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate')
            ->willThrowException(OrderValidationException::invalidCustomerData('Invalid email format'));

        $this->orderRepository
            ->expects($this->never())
            ->method('save');

        $this->eventDispatcher
            ->expects($this->never())
            ->method('dispatch');

        $this->expectException(OrderValidationException::class);
        $this->expectExceptionMessage('Invalid email format');

        ($this->handler)($command);
    }

    public function testInvokeCreatesOrderWithFullCustomerDetails(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'John',
            customerLastName: 'Doe',
            customerPhone: '+1234567890',
            customerCompany: 'Test Company',
            customerAddressLine1: '123 Main St',
            customerAddressLine2: 'Apt 4',
            customerCity: 'New York',
            customerState: 'NY',
            customerPostalCode: '10001',
            customerCountry: 'US',
            currency: 'USD',
            notes: 'Deliver to back door',
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate');

        $this->orderRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Order $order) {
                $customer = $order->customer();
                return $customer->email() === 'test@example.com'
                    && $customer->firstName() === 'John'
                    && $customer->lastName() === 'Doe'
                    && $customer->phone() === '+1234567890'
                    && $customer->company() === 'Test Company'
                    && $customer->addressLine1() === '123 Main St'
                    && $customer->addressLine2() === 'Apt 4'
                    && $customer->city() === 'New York'
                    && $customer->state() === 'NY'
                    && $customer->postalCode() === '10001'
                    && $customer->country() === 'US';
            }));

        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch');

        $result = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $result);
    }

    public function testInvokeDispatchesOrderCreatedEvent(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'John',
            customerLastName: 'Doe',
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate');

        $this->orderRepository
            ->expects($this->once())
            ->method('save');

        $dispatchedEvent = null;
        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->callback(function ($event) use (&$dispatchedEvent) {
                $dispatchedEvent = $event;
                return $event instanceof OrderCreatedEvent;
            }));

        ($this->handler)($command);

        $this->assertInstanceOf(OrderCreatedEvent::class, $dispatchedEvent);
        $this->assertSame('test@example.com', $dispatchedEvent->customerEmail);
    }

    public function testInvokeWithDifferentCurrency(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'test@example.com',
            customerFirstName: 'John',
            customerLastName: 'Doe',
            currency: 'EUR',
            items: [
                [
                    'product_id' => 'prod-1',
                    'product_name' => 'Test Product',
                    'quantity' => 1,
                    'unit_price' => 2000,
                ],
            ],
        );

        $this->validationService
            ->expects($this->once())
            ->method('validateCreate');

        $this->orderRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Order $order) {
                return $order->totalAmount()->currency() === 'EUR'
                    && $order->totalAmount()->amount() === 2000;
            }));

        $this->eventDispatcher
            ->expects($this->once())
            ->method('dispatch');

        $result = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $result);
    }
}
