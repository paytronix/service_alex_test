<?php

declare(strict_types=1);

namespace App\Tests\Functional\Http;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OrderApiTest extends WebTestCase
{
    private KernelBrowser $client;
    private OrderRepositoryInterface $orderRepository;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->orderRepository = static::getContainer()->get(OrderRepositoryInterface::class);
    }

    public function testCreateOrder(): void
    {
        $payload = [
            'customer_email' => 'test@example.com',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
            'customer_phone' => '+1234567890',
            'currency' => 'USD',
            'notes' => 'Test order',
            'items' => [
                [
                    'product_id' => 'prod-001',
                    'product_name' => 'Test Product',
                    'quantity' => 2,
                    'unit_price' => 1000,
                ],
            ],
        ];

        $this->client->request(
            'POST',
            '/orders',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(201, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('id', $data);
        $this->assertEquals('draft', $data['status']);
        $this->assertEquals('test@example.com', $data['customer']['email']);
        $this->assertEquals('John', $data['customer']['first_name']);
        $this->assertEquals('Doe', $data['customer']['last_name']);
        $this->assertCount(1, $data['items']);
        $this->assertEquals('prod-001', $data['items'][0]['product_id']);
        $this->assertEquals(2, $data['items'][0]['quantity']);
        $this->assertEquals(2000, $data['total_amount']);
    }

    public function testCreateOrderWithoutItems(): void
    {
        $payload = [
            'customer_email' => 'noitems@example.com',
            'customer_first_name' => 'Jane',
            'customer_last_name' => 'Smith',
            'currency' => 'EUR',
        ];

        $this->client->request(
            'POST',
            '/orders',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(201, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('id', $data);
        $this->assertEquals('draft', $data['status']);
        $this->assertCount(0, $data['items']);
        $this->assertEquals(0, $data['total_amount']);
        $this->assertEquals('EUR', $data['total_currency']);
    }

    public function testFetchOrder(): void
    {
        $order = $this->createTestOrder();

        $this->client->request(
            'GET',
            '/orders/' . $order->id()->value(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $this->client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals($order->id()->value(), $data['id']);
        $this->assertEquals('draft', $data['status']);
        $this->assertEquals('fetch@example.com', $data['customer']['email']);
    }

    public function testFetchOrderNotFound(): void
    {
        $this->client->request(
            'GET',
            '/orders/non-existent-id',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $this->client->getResponse();
        $this->assertEquals(404, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('Not Found', $data['title']);
        $this->assertStringContainsString('non-existent-id', $data['detail']);
    }

    public function testAddOrderItem(): void
    {
        $order = $this->createTestOrder();

        $payload = [
            'product_id' => 'prod-new',
            'product_name' => 'New Product',
            'quantity' => 3,
            'unit_price' => 500,
        ];

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/items',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(201, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertCount(1, $data['items']);
        $this->assertEquals('prod-new', $data['items'][0]['product_id']);
        $this->assertEquals(3, $data['items'][0]['quantity']);
        $this->assertEquals(1500, $data['total_amount']);
    }

    public function testAddOrderItemToNonExistentOrder(): void
    {
        $payload = [
            'product_id' => 'prod-001',
            'product_name' => 'Test Product',
            'quantity' => 1,
            'unit_price' => 100,
        ];

        $this->client->request(
            'POST',
            '/orders/non-existent-id/items',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(404, $response->getStatusCode());
    }

    public function testSubmitOrder(): void
    {
        $order = $this->createTestOrderWithItems();

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/submit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $this->client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('submitted', $data['status']);
        $this->assertNotNull($data['submitted_at']);
    }

    public function testSubmitEmptyOrder(): void
    {
        $order = $this->createTestOrder();

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/submit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $this->client->getResponse();
        $this->assertEquals(422, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('Unprocessable Entity', $data['title']);
        $this->assertStringContainsString('no items', $data['detail']);
    }

    public function testCancelOrder(): void
    {
        $order = $this->createTestOrder();

        $payload = [
            'reason' => 'Customer requested cancellation',
        ];

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('cancelled', $data['status']);
        $this->assertEquals('Customer requested cancellation', $data['cancellation_reason']);
        $this->assertNotNull($data['cancelled_at']);
    }

    public function testCancelOrderWithoutReason(): void
    {
        $order = $this->createTestOrder();

        $payload = [];

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(400, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('errors', $data);
    }

    public function testCancelAlreadyCancelledOrder(): void
    {
        $order = $this->createTestOrder();
        $order->cancel('Initial cancellation');
        $this->orderRepository->save($order);

        $payload = [
            'reason' => 'Second cancellation attempt',
        ];

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(422, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('Unprocessable Entity', $data['title']);
    }

    public function testValidationFailureOnCreateOrder(): void
    {
        $payload = [
            'customer_email' => 'invalid-email',
            'customer_first_name' => '',
            'customer_last_name' => 'Doe',
        ];

        $this->client->request(
            'POST',
            '/orders',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(400, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('Bad Request', $data['title']);
        $this->assertArrayHasKey('errors', $data);
    }

    public function testValidationFailureOnAddItem(): void
    {
        $order = $this->createTestOrder();

        $payload = [
            'product_id' => '',
            'product_name' => '',
            'quantity' => -1,
            'unit_price' => -100,
        ];

        $this->client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/items',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(400, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('errors', $data);
    }

    private function createTestOrder(): Order
    {
        $customer = OrderCustomer::create(
            email: 'fetch@example.com',
            firstName: 'Test',
            lastName: 'User',
        );

        $order = Order::create($customer, 'USD', 'Test order');
        $this->orderRepository->save($order);

        return $order;
    }

    private function createTestOrderWithItems(): Order
    {
        $customer = OrderCustomer::create(
            email: 'submit@example.com',
            firstName: 'Submit',
            lastName: 'Test',
        );

        $order = Order::create($customer, 'USD', 'Order with items');
        $order->addItem(
            productId: 'prod-submit',
            productName: 'Submit Product',
            quantity: 1,
            unitPrice: Money::create(1000, 'USD'),
        );
        $this->orderRepository->save($order);

        return $order;
    }
}
