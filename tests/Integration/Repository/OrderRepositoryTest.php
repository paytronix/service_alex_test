<?php

declare(strict_types=1);

namespace App\Tests\Integration\Repository;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Infrastructure\Persistence\MongoDB\Document\OrderDocument;
use App\Infrastructure\Persistence\MongoDB\Repository\OrderRepository;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class OrderRepositoryTest extends KernelTestCase
{
    private ?DocumentManager $documentManager = null;
    private ?OrderRepositoryInterface $orderRepository = null;

    protected function setUp(): void
    {
        self::bootKernel();

        $container = static::getContainer();

        $this->documentManager = $container->get('doctrine_mongodb.odm.document_manager');
        $this->orderRepository = new OrderRepository($this->documentManager);

        $this->clearCollection();
    }

    protected function tearDown(): void
    {
        $this->clearCollection();

        parent::tearDown();

        $this->documentManager = null;
        $this->orderRepository = null;
    }

    private function clearCollection(): void
    {
        if ($this->documentManager !== null) {
            $collection = $this->documentManager->getDocumentCollection(OrderDocument::class);
            $collection->deleteMany([]);
        }
    }

    private function createCustomer(string $email = 'john.doe@example.com'): OrderCustomer
    {
        return OrderCustomer::create(
            $email,
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

    private function createOrder(string $email = 'john.doe@example.com'): Order
    {
        $customer = $this->createCustomer($email);
        $order = Order::create($customer, 'USD', 'Test order');
        $order->addItem('PROD-001', 'Product One', 2, Money::create(1000, 'USD'));
        $order->addItem('PROD-002', 'Product Two', 1, Money::create(500, 'USD'));

        return $order;
    }

    public function testSaveStoresDocumentAndCanBeRetrieved(): void
    {
        $order = $this->createOrder();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($retrievedOrder);
        $this->assertEquals($orderId->value(), $retrievedOrder->id()->value());
        $this->assertEquals('john.doe@example.com', $retrievedOrder->customer()->email());
        $this->assertEquals('John', $retrievedOrder->customer()->firstName());
        $this->assertEquals('Doe', $retrievedOrder->customer()->lastName());
        $this->assertTrue($retrievedOrder->status()->isDraft());
        $this->assertEquals(2, $retrievedOrder->itemCount());
        $this->assertEquals(2500, $retrievedOrder->totalAmount()->amount());
        $this->assertEquals('USD', $retrievedOrder->totalAmount()->currency());
        $this->assertEquals('Test order', $retrievedOrder->notes());
    }

    public function testFindByIdReturnsCorrectEntity(): void
    {
        $order1 = $this->createOrder('user1@example.com');
        $order2 = $this->createOrder('user2@example.com');
        $order3 = $this->createOrder('user3@example.com');

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($order2->id());

        $this->assertNotNull($retrievedOrder);
        $this->assertEquals($order2->id()->value(), $retrievedOrder->id()->value());
        $this->assertEquals('user2@example.com', $retrievedOrder->customer()->email());
    }

    public function testFindByIdReturnsNullForNonExistent(): void
    {
        $nonExistentId = OrderId::generate();

        $retrievedOrder = $this->orderRepository->findById($nonExistentId);

        $this->assertNull($retrievedOrder);
    }

    public function testRemoveDeletesEntity(): void
    {
        $order = $this->createOrder();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);
        $this->assertNotNull($retrievedOrder);

        $this->orderRepository->remove($retrievedOrder);

        $this->documentManager->clear();

        $deletedOrder = $this->orderRepository->findById($orderId);
        $this->assertNull($deletedOrder);
    }

    public function testFindByCustomerEmail(): void
    {
        $order1 = $this->createOrder('customer1@example.com');
        $order2 = $this->createOrder('customer1@example.com');
        $order3 = $this->createOrder('customer2@example.com');

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->documentManager->clear();

        $orders = $this->orderRepository->findByCustomerEmail('customer1@example.com');

        $this->assertCount(2, $orders);
        foreach ($orders as $order) {
            $this->assertEquals('customer1@example.com', $order->customer()->email());
        }
    }

    public function testFindByStatus(): void
    {
        $order1 = $this->createOrder('user1@example.com');
        $order2 = $this->createOrder('user2@example.com');
        $order3 = $this->createOrder('user3@example.com');

        $order2->submit();

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->documentManager->clear();

        $draftOrders = $this->orderRepository->findByStatus(OrderStatus::draft());
        $submittedOrders = $this->orderRepository->findByStatus(OrderStatus::submitted());

        $this->assertCount(2, $draftOrders);
        $this->assertCount(1, $submittedOrders);

        foreach ($draftOrders as $order) {
            $this->assertTrue($order->status()->isDraft());
        }

        foreach ($submittedOrders as $order) {
            $this->assertTrue($order->status()->isSubmitted());
        }
    }

    public function testFindAll(): void
    {
        $order1 = $this->createOrder('user1@example.com');
        $order2 = $this->createOrder('user2@example.com');
        $order3 = $this->createOrder('user3@example.com');

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->documentManager->clear();

        $allOrders = $this->orderRepository->findAll();

        $this->assertCount(3, $allOrders);
    }

    public function testFindAllWithLimitAndOffset(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $order = $this->createOrder("user{$i}@example.com");
            $this->orderRepository->save($order);
        }

        $this->documentManager->clear();

        $limitedOrders = $this->orderRepository->findAll(2, 0);
        $this->assertCount(2, $limitedOrders);

        $offsetOrders = $this->orderRepository->findAll(2, 2);
        $this->assertCount(2, $offsetOrders);

        $lastOrders = $this->orderRepository->findAll(10, 4);
        $this->assertCount(1, $lastOrders);
    }

    public function testCount(): void
    {
        $this->assertEquals(0, $this->orderRepository->count());

        $order1 = $this->createOrder('user1@example.com');
        $order2 = $this->createOrder('user2@example.com');
        $order3 = $this->createOrder('user3@example.com');

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->assertEquals(3, $this->orderRepository->count());
    }

    public function testCountByStatus(): void
    {
        $order1 = $this->createOrder('user1@example.com');
        $order2 = $this->createOrder('user2@example.com');
        $order3 = $this->createOrder('user3@example.com');

        $order2->submit();
        $order3->submit();

        $this->orderRepository->save($order1);
        $this->orderRepository->save($order2);
        $this->orderRepository->save($order3);

        $this->assertEquals(1, $this->orderRepository->countByStatus(OrderStatus::draft()));
        $this->assertEquals(2, $this->orderRepository->countByStatus(OrderStatus::submitted()));
        $this->assertEquals(0, $this->orderRepository->countByStatus(OrderStatus::confirmed()));
    }

    public function testNextIdentity(): void
    {
        $id1 = $this->orderRepository->nextIdentity();
        $id2 = $this->orderRepository->nextIdentity();

        $this->assertInstanceOf(OrderId::class, $id1);
        $this->assertInstanceOf(OrderId::class, $id2);
        $this->assertFalse($id1->equals($id2));
    }

    public function testSaveUpdatesExistingDocument(): void
    {
        $order = $this->createOrder();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);
        $this->assertNotNull($retrievedOrder);
        $this->assertEquals('Test order', $retrievedOrder->notes());

        $retrievedOrder->updateNotes('Updated notes');
        $this->orderRepository->save($retrievedOrder);

        $this->documentManager->clear();

        $updatedOrder = $this->orderRepository->findById($orderId);
        $this->assertNotNull($updatedOrder);
        $this->assertEquals('Updated notes', $updatedOrder->notes());
    }

    public function testSavePreservesOrderItems(): void
    {
        $order = $this->createOrder();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($retrievedOrder);
        $this->assertEquals(2, $retrievedOrder->itemCount());

        $items = $retrievedOrder->items();
        $this->assertCount(2, $items);

        $productIds = array_map(fn($item) => $item->productId(), $items);
        $this->assertContains('PROD-001', $productIds);
        $this->assertContains('PROD-002', $productIds);
    }

    public function testSavePreservesCustomerDetails(): void
    {
        $order = $this->createOrder();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($retrievedOrder);

        $customer = $retrievedOrder->customer();
        $this->assertEquals('john.doe@example.com', $customer->email());
        $this->assertEquals('John', $customer->firstName());
        $this->assertEquals('Doe', $customer->lastName());
        $this->assertEquals('+1234567890', $customer->phone());
        $this->assertEquals('Acme Corp', $customer->company());
        $this->assertEquals('123 Main St', $customer->addressLine1());
        $this->assertEquals('Suite 100', $customer->addressLine2());
        $this->assertEquals('New York', $customer->city());
        $this->assertEquals('NY', $customer->state());
        $this->assertEquals('10001', $customer->postalCode());
        $this->assertEquals('US', $customer->country());
    }

    public function testSavePreservesOrderStatus(): void
    {
        $order = $this->createOrder();
        $order->submit();
        $order->confirm();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($retrievedOrder);
        $this->assertTrue($retrievedOrder->status()->isConfirmed());
    }

    public function testSavePreservesTimestamps(): void
    {
        $order = $this->createOrder();
        $order->submit();
        $orderId = $order->id();

        $this->orderRepository->save($order);

        $this->documentManager->clear();

        $retrievedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($retrievedOrder);
        $this->assertNotNull($retrievedOrder->createdAt());
        $this->assertNotNull($retrievedOrder->updatedAt());
        $this->assertNotNull($retrievedOrder->submittedAt());
    }
}
