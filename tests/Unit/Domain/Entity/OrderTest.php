<?php

declare(strict_types=1);

namespace App\Tests\Unit\Domain\Entity;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Event\OrderCancelledEvent;
use App\Domain\Event\OrderCreatedEvent;
use App\Domain\Event\OrderItemAddedEvent;
use App\Domain\Event\OrderSubmittedEvent;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderStatus;
use DomainException;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class OrderTest extends TestCase
{
    private function createCustomer(): OrderCustomer
    {
        return OrderCustomer::create(
            'john.doe@example.com',
            'John',
            'Doe',
            '+1234567890',
            'Acme Corp',
            '123 Main St',
            'Suite 100',
            'New York',
            'NY',
            '10001',
            'US'
        );
    }

    public function testCreateOrderRecordsOrderCreatedEvent(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer, 'USD', 'Test order notes');

        $this->assertTrue($order->hasDomainEvents());

        $events = $order->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(OrderCreatedEvent::class, $events[0]);
        $this->assertEquals($order->id()->value(), $events[0]->orderId()->value());
        $this->assertEquals('john.doe@example.com', $events[0]->customerEmail());
    }

    public function testCreateOrderSetsInitialState(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer, 'USD', 'Test notes');

        $this->assertTrue($order->status()->isDraft());
        $this->assertTrue($order->isEmpty());
        $this->assertEquals(0, $order->itemCount());
        $this->assertTrue($order->totalAmount()->isZero());
        $this->assertEquals('USD', $order->totalAmount()->currency());
        $this->assertEquals('Test notes', $order->notes());
        $this->assertNull($order->cancellationReason());
        $this->assertNull($order->submittedAt());
        $this->assertNull($order->cancelledAt());
    }

    public function testAddItemUpdatesTotalPrice(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);
        $order->pullDomainEvents();

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));

        $this->assertEquals(1, $order->itemCount());
        $this->assertEquals(2000, $order->totalAmount()->amount());
        $this->assertEquals('USD', $order->totalAmount()->currency());

        $order->addItem('PROD-002', 'Product Two', 3, Money::create(500, 'USD'));

        $this->assertEquals(2, $order->itemCount());
        $this->assertEquals(3500, $order->totalAmount()->amount());
    }

    public function testAddItemRecordsOrderItemAddedEvent(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);
        $order->pullDomainEvents();

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));

        $events = $order->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(OrderItemAddedEvent::class, $events[0]);
        $this->assertEquals('PROD-001', $events[0]->productId());
        $this->assertEquals('Product One', $events[0]->productName());
        $this->assertEquals(2, $events[0]->quantity());
    }

    public function testAddSameProductIncreasesQuantity(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $order->addItem('PROD-001', 'Product One', 3, Money::create(1000, 'USD'));

        $this->assertEquals(1, $order->itemCount());
        $item = $order->findItemByProductId('PROD-001');
        $this->assertNotNull($item);
        $this->assertEquals(5, $item->quantity());
        $this->assertEquals(5000, $order->totalAmount()->amount());
    }

    public function testCannotAddItemWithDifferentCurrency(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer, 'USD');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Item currency (EUR) must match order currency (USD)');

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'EUR'));
    }

    public function testRemoveItemUpdatesTotalPrice(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $order->addItem('PROD-002', 'Product Two', 1, Money::create(500, 'USD'));

        $item = $order->findItemByProductId('PROD-001');
        $order->removeItem($item->id());

        $this->assertEquals(1, $order->itemCount());
        $this->assertEquals(500, $order->totalAmount()->amount());
    }

    public function testRemoveNonExistentItemThrowsException(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Item with ID non-existent-id not found in order');

        $order->removeItem('non-existent-id');
    }

    public function testUpdateItemQuantity(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $item = $order->findItemByProductId('PROD-001');

        $order->updateItemQuantity($item->id(), 5);

        $updatedItem = $order->findItemByProductId('PROD-001');
        $this->assertEquals(5, $updatedItem->quantity());
        $this->assertEquals(5000, $order->totalAmount()->amount());
    }

    public function testClearItems(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $order->addItem('PROD-002', 'Product Two', 1, Money::create(500, 'USD'));

        $order->clearItems();

        $this->assertTrue($order->isEmpty());
        $this->assertEquals(0, $order->itemCount());
        $this->assertTrue($order->totalAmount()->isZero());
    }

    public function testSubmitOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);
        $order->pullDomainEvents();

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $order->pullDomainEvents();

        $order->submit();

        $this->assertTrue($order->status()->isSubmitted());
        $this->assertNotNull($order->submittedAt());

        $events = $order->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(OrderSubmittedEvent::class, $events[0]);
        $this->assertEquals(2000, $events[0]->totalAmount()->amount());
        $this->assertEquals(1, $events[0]->itemCount());
    }

    public function testCannotSubmitAlreadySubmittedOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot submit order: order is in submitted status, expected draft');

        $order->submit();
    }

    public function testCannotSubmitEmptyOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot submit order: order has no items');

        $order->submit();
    }

    public function testConfirmOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();
        $order->confirm();

        $this->assertTrue($order->status()->isConfirmed());
    }

    public function testCannotConfirmNonSubmittedOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot confirm order: order is in draft status, expected submitted');

        $order->confirm();
    }

    public function testOrderWorkflow(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));

        $this->assertTrue($order->status()->isDraft());

        $order->submit();
        $this->assertTrue($order->status()->isSubmitted());

        $order->confirm();
        $this->assertTrue($order->status()->isConfirmed());

        $order->startProcessing();
        $this->assertTrue($order->status()->isProcessing());

        $order->ship();
        $this->assertTrue($order->status()->isShipped());

        $order->deliver();
        $this->assertTrue($order->status()->isDelivered());
    }

    public function testCancelOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);
        $order->pullDomainEvents();

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->pullDomainEvents();

        $order->cancel('Customer requested cancellation');

        $this->assertTrue($order->status()->isCancelled());
        $this->assertEquals('Customer requested cancellation', $order->cancellationReason());
        $this->assertNotNull($order->cancelledAt());

        $events = $order->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(OrderCancelledEvent::class, $events[0]);
        $this->assertEquals('Customer requested cancellation', $events[0]->reason());
    }

    public function testCannotCancelDeliveredOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();
        $order->confirm();
        $order->startProcessing();
        $order->ship();
        $order->deliver();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot cancel order: order is in final status delivered');

        $order->cancel('Too late');
    }

    public function testCannotCancelWithEmptyReason(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cancellation reason cannot be empty');

        $order->cancel('');
    }

    public function testRefundOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();
        $order->confirm();
        $order->startProcessing();
        $order->ship();
        $order->deliver();

        $order->refund();

        $this->assertTrue($order->status()->isRefunded());
    }

    public function testCannotModifySubmittedOrder(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot modify order: order is in submitted status');

        $order->addItem('PROD-002', 'Product Two', 1, Money::create(500, 'USD'));
    }

    public function testUpdateCustomer(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $newCustomer = OrderCustomer::create(
            'jane.doe@example.com',
            'Jane',
            'Doe'
        );

        $order->updateCustomer($newCustomer);

        $this->assertEquals('jane.doe@example.com', $order->customer()->email());
        $this->assertEquals('Jane', $order->customer()->firstName());
    }

    public function testUpdateNotes(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer, 'USD', 'Initial notes');

        $order->updateNotes('Updated notes');

        $this->assertEquals('Updated notes', $order->notes());
    }

    public function testFindItemById(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $item = $order->findItemByProductId('PROD-001');

        $foundItem = $order->findItemById($item->id());

        $this->assertNotNull($foundItem);
        $this->assertEquals('PROD-001', $foundItem->productId());
    }

    public function testFindItemByIdReturnsNullForNonExistent(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $foundItem = $order->findItemById('non-existent-id');

        $this->assertNull($foundItem);
    }

    public function testCanBeModified(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->assertTrue($order->canBeModified());

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();

        $this->assertFalse($order->canBeModified());
    }

    public function testCanBeCancelled(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->assertTrue($order->canBeCancelled());

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));
        $order->submit();
        $order->confirm();
        $order->startProcessing();
        $order->ship();
        $order->deliver();

        $this->assertFalse($order->canBeCancelled());
    }

    public function testCanBeSubmitted(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->assertFalse($order->canBeSubmitted());

        $order->addItem('PROD-001', 'Product One', 1, Money::create(1000, 'USD'));

        $this->assertTrue($order->canBeSubmitted());

        $order->submit();

        $this->assertFalse($order->canBeSubmitted());
    }

    public function testToArray(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer, 'USD', 'Test notes');

        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));

        $array = $order->toArray();

        $this->assertArrayHasKey('id', $array);
        $this->assertArrayHasKey('customer', $array);
        $this->assertArrayHasKey('status', $array);
        $this->assertArrayHasKey('items', $array);
        $this->assertArrayHasKey('total_amount', $array);
        $this->assertArrayHasKey('total_currency', $array);
        $this->assertArrayHasKey('notes', $array);
        $this->assertArrayHasKey('created_at', $array);
        $this->assertArrayHasKey('updated_at', $array);

        $this->assertEquals('draft', $array['status']);
        $this->assertEquals(2000, $array['total_amount']);
        $this->assertEquals('USD', $array['total_currency']);
        $this->assertEquals('Test notes', $array['notes']);
        $this->assertCount(1, $array['items']);
    }

    public function testDomainEventsAreRecorded(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $this->assertTrue($order->hasDomainEvents());

        $events = $order->pullDomainEvents();

        $this->assertFalse($order->hasDomainEvents());
        $this->assertCount(1, $events);
    }

    public function testPullDomainEventsClearsEvents(): void
    {
        $customer = $this->createCustomer();
        $order = Order::create($customer);

        $order->pullDomainEvents();

        $this->assertFalse($order->hasDomainEvents());
        $this->assertEmpty($order->pullDomainEvents());
    }
}
