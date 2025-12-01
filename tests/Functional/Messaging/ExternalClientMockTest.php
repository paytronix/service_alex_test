<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Domain\ValueObject\Timestamp;
use App\Infrastructure\ExternalService\PaymentServiceClientInterface;
use App\Infrastructure\ExternalService\POSServiceClientInterface;
use App\Infrastructure\ExternalService\RestaurantServiceClientInterface;
use App\Infrastructure\ExternalService\StubPaymentServiceClient;
use App\Infrastructure\ExternalService\StubPOSServiceClient;
use App\Infrastructure\ExternalService\StubRestaurantServiceClient;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class ExternalClientMockTest extends KernelTestCase
{
    private RestaurantServiceClientInterface $restaurantClient;
    private PaymentServiceClientInterface $paymentClient;
    private POSServiceClientInterface $posClient;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->restaurantClient = $container->get(RestaurantServiceClientInterface::class);
        $this->paymentClient = $container->get(PaymentServiceClientInterface::class);
        $this->posClient = $container->get(POSServiceClientInterface::class);
    }

    public function testRestaurantClientIsStubImplementation(): void
    {
        $this->assertInstanceOf(StubRestaurantServiceClient::class, $this->restaurantClient);
    }

    public function testPaymentClientIsStubImplementation(): void
    {
        $this->assertInstanceOf(StubPaymentServiceClient::class, $this->paymentClient);
    }

    public function testPOSClientIsStubImplementation(): void
    {
        $this->assertInstanceOf(StubPOSServiceClient::class, $this->posClient);
    }

    public function testRestaurantClientNotifiesOrderCreated(): void
    {
        $orderId = OrderId::fromString('restaurant-notify-test-' . uniqid());

        $this->restaurantClient->notifyOrderCreated($orderId, 'test@example.com');

        $this->assertInstanceOf(StubRestaurantServiceClient::class, $this->restaurantClient);
        $notifiedOrders = $this->restaurantClient->getNotifiedOrders();

        $this->assertArrayHasKey($orderId->value(), $notifiedOrders);
        $this->assertEquals('created', $notifiedOrders[$orderId->value()]['type']);
        $this->assertEquals('test@example.com', $notifiedOrders[$orderId->value()]['customer_email']);
    }

    public function testRestaurantClientNotifiesOrderCancelled(): void
    {
        $orderId = OrderId::fromString('restaurant-cancel-test-' . uniqid());

        $this->restaurantClient->notifyOrderCancelled($orderId, 'Customer requested');

        $this->assertInstanceOf(StubRestaurantServiceClient::class, $this->restaurantClient);
        $notifiedOrders = $this->restaurantClient->getNotifiedOrders();

        $this->assertArrayHasKey($orderId->value(), $notifiedOrders);
        $this->assertEquals('cancelled', $notifiedOrders[$orderId->value()]['type']);
        $this->assertEquals('Customer requested', $notifiedOrders[$orderId->value()]['reason']);
    }

    public function testRestaurantClientChecksAvailability(): void
    {
        $isAvailable = $this->restaurantClient->checkRestaurantAvailability('restaurant-123');

        $this->assertTrue($isAvailable);
    }

    public function testRestaurantClientGetsDetails(): void
    {
        $details = $this->restaurantClient->getRestaurantDetails('restaurant-123');

        $this->assertIsArray($details);
        $this->assertArrayHasKey('id', $details);
        $this->assertArrayHasKey('name', $details);
    }

    public function testPaymentClientInitiatesPayment(): void
    {
        $orderId = OrderId::fromString('payment-init-test-' . uniqid());
        $amount = Money::fromFloat(100.00, 'USD');

        $paymentId = $this->paymentClient->initiatePayment($orderId, $amount);

        $this->assertNotEmpty($paymentId);
        $this->assertStringStartsWith('payment_', $paymentId);

        $this->assertInstanceOf(StubPaymentServiceClient::class, $this->paymentClient);
        $payments = $this->paymentClient->getPayments();

        $this->assertArrayHasKey($orderId->value(), $payments);
        $this->assertEquals('initiated', $payments[$orderId->value()]['status']);
    }

    public function testPaymentClientCancelsPayment(): void
    {
        $orderId = OrderId::fromString('payment-cancel-test-' . uniqid());
        $amount = Money::fromFloat(50.00, 'USD');

        $paymentId = $this->paymentClient->initiatePayment($orderId, $amount);
        $this->paymentClient->cancelPayment($orderId, $paymentId);

        $this->assertInstanceOf(StubPaymentServiceClient::class, $this->paymentClient);
        $payments = $this->paymentClient->getPayments();

        $this->assertArrayHasKey($orderId->value(), $payments);
        $this->assertEquals('cancelled', $payments[$orderId->value()]['status']);
    }

    public function testPaymentClientRefundsPayment(): void
    {
        $orderId = OrderId::fromString('payment-refund-test-' . uniqid());
        $amount = Money::fromFloat(75.00, 'USD');

        $paymentId = $this->paymentClient->initiatePayment($orderId, $amount);
        $refundId = $this->paymentClient->refundPayment($orderId, $paymentId, $amount);

        $this->assertNotEmpty($refundId);
        $this->assertStringStartsWith('refund_', $refundId);
    }

    public function testPaymentClientGetsStatus(): void
    {
        $orderId = OrderId::fromString('payment-status-test-' . uniqid());
        $amount = Money::fromFloat(25.00, 'USD');

        $paymentId = $this->paymentClient->initiatePayment($orderId, $amount);
        $status = $this->paymentClient->getPaymentStatus($paymentId);

        $this->assertIsArray($status);
        $this->assertArrayHasKey('payment_id', $status);
        $this->assertArrayHasKey('status', $status);
    }

    public function testPOSClientSendsOrder(): void
    {
        $order = $this->createTestOrder('pos-send-test-' . uniqid());

        $posOrderId = $this->posClient->sendOrderToPOS($order->id(), $order);

        $this->assertNotEmpty($posOrderId);
        $this->assertStringStartsWith('pos_', $posOrderId);

        $this->assertInstanceOf(StubPOSServiceClient::class, $this->posClient);
        $posOrders = $this->posClient->getOrders();

        $this->assertArrayHasKey($order->id()->value(), $posOrders);
        $this->assertEquals('sent', $posOrders[$order->id()->value()]['status']);
    }

    public function testPOSClientCancelsOrder(): void
    {
        $order = $this->createTestOrder('pos-cancel-test-' . uniqid());

        $posOrderId = $this->posClient->sendOrderToPOS($order->id(), $order);
        $this->posClient->cancelOrderInPOS($order->id(), $posOrderId);

        $this->assertInstanceOf(StubPOSServiceClient::class, $this->posClient);
        $posOrders = $this->posClient->getOrders();

        $this->assertArrayHasKey($order->id()->value(), $posOrders);
        $this->assertEquals('cancelled', $posOrders[$order->id()->value()]['status']);
    }

    public function testPOSClientUpdatesOrder(): void
    {
        $order = $this->createTestOrder('pos-update-test-' . uniqid());

        $posOrderId = $this->posClient->sendOrderToPOS($order->id(), $order);
        $this->posClient->updateOrderInPOS($order->id(), $posOrderId, ['notes' => 'Updated notes']);

        $this->assertInstanceOf(StubPOSServiceClient::class, $this->posClient);
        $posOrders = $this->posClient->getOrders();

        $this->assertArrayHasKey($order->id()->value(), $posOrders);
    }

    public function testPOSClientGetsStatus(): void
    {
        $order = $this->createTestOrder('pos-status-test-' . uniqid());

        $posOrderId = $this->posClient->sendOrderToPOS($order->id(), $order);
        $status = $this->posClient->getOrderStatusFromPOS($posOrderId);

        $this->assertIsArray($status);
        $this->assertArrayHasKey('pos_order_id', $status);
        $this->assertArrayHasKey('status', $status);
    }

    private function createTestOrder(string $orderId): Order
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

        return $order;
    }
}
