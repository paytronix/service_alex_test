<?php

declare(strict_types=1);

namespace App\Tests\Integration\Application\Handler;

use App\Application\Command\CreateOrderCommand;
use App\Application\Command\Handler\CreateOrderHandler;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class CreateOrderHandlerIntegrationTest extends KernelTestCase
{
    private ?CreateOrderHandler $handler = null;
    private ?OrderRepositoryInterface $orderRepository = null;

    protected function setUp(): void
    {
        self::bootKernel();

        $container = static::getContainer();

        $this->handler = $container->get(CreateOrderHandler::class);
        $this->orderRepository = $container->get(OrderRepositoryInterface::class);
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        $this->handler = null;
        $this->orderRepository = null;
    }

    public function testCreateOrderAndRetrieveFromRepository(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'integration-test@example.com',
            customerFirstName: 'Integration',
            customerLastName: 'Test',
            customerPhone: '+1234567890',
            customerCompany: 'Test Company',
            customerAddressLine1: '123 Test Street',
            customerCity: 'Test City',
            customerState: 'TS',
            customerPostalCode: '12345',
            customerCountry: 'US',
            currency: 'USD',
            notes: 'Integration test order',
            items: [
                [
                    'product_id' => 'test-product-1',
                    'product_name' => 'Test Product 1',
                    'quantity' => 2,
                    'unit_price' => 1000,
                ],
                [
                    'product_id' => 'test-product-2',
                    'product_name' => 'Test Product 2',
                    'quantity' => 1,
                    'unit_price' => 2500,
                ],
            ],
        );

        $orderId = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $orderId);

        $savedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($savedOrder);
        $this->assertTrue($orderId->equals($savedOrder->id()));
        $this->assertSame('integration-test@example.com', $savedOrder->customer()->email());
        $this->assertSame('Integration', $savedOrder->customer()->firstName());
        $this->assertSame('Test', $savedOrder->customer()->lastName());
        $this->assertSame('+1234567890', $savedOrder->customer()->phone());
        $this->assertSame('Test Company', $savedOrder->customer()->company());
        $this->assertSame('123 Test Street', $savedOrder->customer()->addressLine1());
        $this->assertSame('Test City', $savedOrder->customer()->city());
        $this->assertSame('TS', $savedOrder->customer()->state());
        $this->assertSame('12345', $savedOrder->customer()->postalCode());
        $this->assertSame('US', $savedOrder->customer()->country());
        $this->assertSame('USD', $savedOrder->totalAmount()->currency());
        $this->assertSame('Integration test order', $savedOrder->notes());
        $this->assertSame(2, $savedOrder->itemCount());
        $this->assertSame(4500, $savedOrder->totalAmount()->amount());
        $this->assertTrue($savedOrder->status()->isDraft());

        $this->orderRepository->remove($savedOrder);
    }

    public function testCreateOrderWithoutItems(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'no-items-test@example.com',
            customerFirstName: 'No',
            customerLastName: 'Items',
            currency: 'USD',
        );

        $orderId = ($this->handler)($command);

        $this->assertInstanceOf(OrderId::class, $orderId);

        $savedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($savedOrder);
        $this->assertTrue($savedOrder->isEmpty());
        $this->assertSame(0, $savedOrder->totalAmount()->amount());

        $this->orderRepository->remove($savedOrder);
    }

    public function testCreateOrderWithDifferentCurrency(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'eur-test@example.com',
            customerFirstName: 'Euro',
            customerLastName: 'Test',
            currency: 'EUR',
            items: [
                [
                    'product_id' => 'euro-product',
                    'product_name' => 'Euro Product',
                    'quantity' => 1,
                    'unit_price' => 5000,
                ],
            ],
        );

        $orderId = ($this->handler)($command);

        $savedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($savedOrder);
        $this->assertSame('EUR', $savedOrder->totalAmount()->currency());
        $this->assertSame(5000, $savedOrder->totalAmount()->amount());

        $this->orderRepository->remove($savedOrder);
    }

    public function testCreateMultipleOrdersWithSameCustomer(): void
    {
        $command1 = new CreateOrderCommand(
            customerEmail: 'multi-order@example.com',
            customerFirstName: 'Multi',
            customerLastName: 'Order',
            currency: 'USD',
            items: [
                [
                    'product_id' => 'product-a',
                    'product_name' => 'Product A',
                    'quantity' => 1,
                    'unit_price' => 1000,
                ],
            ],
        );

        $command2 = new CreateOrderCommand(
            customerEmail: 'multi-order@example.com',
            customerFirstName: 'Multi',
            customerLastName: 'Order',
            currency: 'USD',
            items: [
                [
                    'product_id' => 'product-b',
                    'product_name' => 'Product B',
                    'quantity' => 2,
                    'unit_price' => 2000,
                ],
            ],
        );

        $orderId1 = ($this->handler)($command1);
        $orderId2 = ($this->handler)($command2);

        $this->assertFalse($orderId1->equals($orderId2));

        $order1 = $this->orderRepository->findById($orderId1);
        $order2 = $this->orderRepository->findById($orderId2);

        $this->assertNotNull($order1);
        $this->assertNotNull($order2);
        $this->assertSame(1000, $order1->totalAmount()->amount());
        $this->assertSame(4000, $order2->totalAmount()->amount());

        $customerOrders = $this->orderRepository->findByCustomerEmail('multi-order@example.com');
        $this->assertGreaterThanOrEqual(2, count($customerOrders));

        $this->orderRepository->remove($order1);
        $this->orderRepository->remove($order2);
    }

    public function testCreateOrderPreservesItemDetails(): void
    {
        $command = new CreateOrderCommand(
            customerEmail: 'item-details@example.com',
            customerFirstName: 'Item',
            customerLastName: 'Details',
            currency: 'USD',
            items: [
                [
                    'product_id' => 'detailed-product',
                    'product_name' => 'Detailed Product Name',
                    'product_sku' => 'SKU-12345',
                    'quantity' => 3,
                    'unit_price' => 1500,
                    'notes' => 'Special handling required',
                ],
            ],
        );

        $orderId = ($this->handler)($command);

        $savedOrder = $this->orderRepository->findById($orderId);

        $this->assertNotNull($savedOrder);
        $this->assertSame(1, $savedOrder->itemCount());

        $items = $savedOrder->items();
        $item = $items[0];

        $this->assertSame('detailed-product', $item->productId());
        $this->assertSame('Detailed Product Name', $item->productName());
        $this->assertSame('SKU-12345', $item->productSku());
        $this->assertSame(3, $item->quantity());
        $this->assertSame(1500, $item->unitPrice()->amount());
        $this->assertSame(4500, $item->totalPrice()->amount());
        $this->assertSame('Special handling required', $item->notes());

        $this->orderRepository->remove($savedOrder);
    }

    public function testCreateOrderGeneratesUniqueIds(): void
    {
        $orderIds = [];

        for ($i = 0; $i < 5; $i++) {
            $command = new CreateOrderCommand(
                customerEmail: "unique-id-test-{$i}@example.com",
                customerFirstName: 'Unique',
                customerLastName: "Test{$i}",
            );

            $orderId = ($this->handler)($command);
            $orderIds[] = $orderId->value();

            $order = $this->orderRepository->findById($orderId);
            $this->orderRepository->remove($order);
        }

        $uniqueIds = array_unique($orderIds);
        $this->assertCount(5, $uniqueIds);
    }
}
