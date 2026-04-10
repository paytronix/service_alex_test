<?php

declare(strict_types=1);

namespace App\Tests\Functional\Security;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AuthorizationTest extends WebTestCase
{
    use SecurityTestTrait;

    public function testUnauthenticatedUserCannotCreateOrders(): void
    {
        $client = static::createClient();

        $payload = [
            'customer_email' => 'test@example.com',
            'customer_first_name' => 'John',
            'customer_last_name' => 'Doe',
            'currency' => 'USD',
        ];

        $client->request(
            'POST',
            '/orders',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $client->getResponse();
        $this->assertEquals(401, $response->getStatusCode());
    }

    public function testUserCanViewOwnOrder(): void
    {
        $client = $this->createAuthenticatedClient('owner@example.com', 'password123');
        $order = $this->createOrderForUser('owner@example.com');

        $client->request(
            'GET',
            '/orders/' . $order->id()->value(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testUserCannotViewOthersOrder(): void
    {
        $client = $this->createAuthenticatedClient('viewer@example.com', 'password123');
        $order = $this->createOrderForUser('other-owner@example.com');

        $client->request(
            'GET',
            '/orders/' . $order->id()->value(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $client->getResponse();
        $this->assertEquals(403, $response->getStatusCode());
    }

    public function testAdminCanViewAnyOrder(): void
    {
        $client = $this->createAuthenticatedClient('admin@example.com', 'password123', ['ROLE_ADMIN']);
        $order = $this->createOrderForUser('someone@example.com');

        $client->request(
            'GET',
            '/orders/' . $order->id()->value(),
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testUserCanCancelOwnOrder(): void
    {
        $client = $this->createAuthenticatedClient('canceller@example.com', 'password123');
        $order = $this->createOrderForUser('canceller@example.com');

        $client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['reason' => 'Changed my mind'])
        );

        $response = $client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('cancelled', $data['status']);
    }

    public function testUserCannotCancelOthersOrder(): void
    {
        $client = $this->createAuthenticatedClient('noncanceller@example.com', 'password123');
        $order = $this->createOrderForUser('order-owner@example.com');

        $client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['reason' => 'I want to cancel this'])
        );

        $response = $client->getResponse();
        $this->assertEquals(403, $response->getStatusCode());
    }

    public function testAdminCanCancelAnyOrder(): void
    {
        $client = $this->createAuthenticatedClient('admin-cancel@example.com', 'password123', ['ROLE_ADMIN']);
        $order = $this->createOrderForUser('any-owner@example.com');

        $client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/cancel',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['reason' => 'Admin cancellation'])
        );

        $response = $client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testUserCanSubmitOwnOrder(): void
    {
        $client = $this->createAuthenticatedClient('submitter@example.com', 'password123');
        $order = $this->createOrderWithItemsForUser('submitter@example.com');

        $client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/submit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('submitted', $data['status']);
    }

    public function testUserCannotSubmitOthersOrder(): void
    {
        $client = $this->createAuthenticatedClient('nonsubmitter@example.com', 'password123');
        $order = $this->createOrderWithItemsForUser('submit-owner@example.com');

        $client->request(
            'POST',
            '/orders/' . $order->id()->value() . '/submit',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $client->getResponse();
        $this->assertEquals(403, $response->getStatusCode());
    }

    private function createOrderForUser(string $userId): Order
    {
        $orderRepository = static::getContainer()->get(OrderRepositoryInterface::class);

        $customer = OrderCustomer::create(
            email: 'customer@test.com',
            firstName: 'Customer',
            lastName: 'Test',
        );

        $order = Order::create($customer, 'USD', null, $userId);
        $orderRepository->save($order);

        return $order;
    }

    private function createOrderWithItemsForUser(string $userId): Order
    {
        $orderRepository = static::getContainer()->get(OrderRepositoryInterface::class);

        $customer = OrderCustomer::create(
            email: 'customer@test.com',
            firstName: 'Customer',
            lastName: 'Test',
        );

        $order = Order::create($customer, 'USD', null, $userId);
        $order->addItem('PROD-001', 'Test Product', 1, Money::create(1000, 'USD'));
        $orderRepository->save($order);

        return $order;
    }
}
