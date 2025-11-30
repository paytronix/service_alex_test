<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\MessageHandler;

use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\ExternalService\PaymentServiceClientInterface;
use App\Infrastructure\ExternalService\POSServiceClientInterface;
use App\Infrastructure\ExternalService\RestaurantServiceClientInterface;
use App\Infrastructure\Messaging\Message\OrderCancelledMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class OrderCancelledMessageHandler
{
    private OrderRepositoryInterface $orderRepository;
    private PaymentServiceClientInterface $paymentServiceClient;
    private POSServiceClientInterface $posServiceClient;
    private RestaurantServiceClientInterface $restaurantServiceClient;
    private LoggerInterface $logger;
    private array $processedEventIds = [];

    public function __construct(
        OrderRepositoryInterface $orderRepository,
        PaymentServiceClientInterface $paymentServiceClient,
        POSServiceClientInterface $posServiceClient,
        RestaurantServiceClientInterface $restaurantServiceClient,
        LoggerInterface $logger
    ) {
        $this->orderRepository = $orderRepository;
        $this->paymentServiceClient = $paymentServiceClient;
        $this->posServiceClient = $posServiceClient;
        $this->restaurantServiceClient = $restaurantServiceClient;
        $this->logger = $logger;
    }

    public function __invoke(OrderCancelledMessage $message): void
    {
        $orderId = $message->getOrderId();
        $eventKey = $this->generateEventKey($message);

        if ($this->isAlreadyProcessed($eventKey)) {
            $this->logger->info('Skipping duplicate OrderCancelledMessage', [
                'order_id' => $orderId,
                'event_key' => $eventKey,
            ]);
            return;
        }

        $this->logger->info('Processing OrderCancelledMessage', [
            'order_id' => $orderId,
            'reason' => $message->getReason(),
            'occurred_on' => $message->getOccurredOn(),
        ]);

        try {
            $order = $this->orderRepository->findById(OrderId::fromString($orderId));

            if ($order === null) {
                $this->logger->warning('Order not found for OrderCancelledMessage', [
                    'order_id' => $orderId,
                ]);
                return;
            }

            $this->paymentServiceClient->cancelPayment($orderId);

            $this->posServiceClient->cancelOrderInPOS($orderId);

            $this->restaurantServiceClient->notifyOrderCancelled(
                $orderId,
                $message->getReason()
            );

            $this->markAsProcessed($eventKey);

            $this->logger->info('Successfully processed OrderCancelledMessage', [
                'order_id' => $orderId,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to process OrderCancelledMessage', [
                'order_id' => $orderId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function generateEventKey(OrderCancelledMessage $message): string
    {
        return sprintf(
            'order_cancelled_%s_%s',
            $message->getOrderId(),
            $message->getOccurredOn()
        );
    }

    private function isAlreadyProcessed(string $eventKey): bool
    {
        return isset($this->processedEventIds[$eventKey]);
    }

    private function markAsProcessed(string $eventKey): void
    {
        $this->processedEventIds[$eventKey] = true;
    }
}
