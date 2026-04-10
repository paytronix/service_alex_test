<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\MessageHandler;

use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\ExternalService\RestaurantServiceClientInterface;
use App\Infrastructure\Messaging\Message\OrderCreatedMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class OrderCreatedMessageHandler
{
    private OrderRepositoryInterface $orderRepository;
    private RestaurantServiceClientInterface $restaurantServiceClient;
    private LoggerInterface $logger;
    private array $processedEventIds = [];

    public function __construct(
        OrderRepositoryInterface $orderRepository,
        RestaurantServiceClientInterface $restaurantServiceClient,
        LoggerInterface $logger
    ) {
        $this->orderRepository = $orderRepository;
        $this->restaurantServiceClient = $restaurantServiceClient;
        $this->logger = $logger;
    }

    public function __invoke(OrderCreatedMessage $message): void
    {
        $orderId = $message->getOrderId();
        $eventKey = $this->generateEventKey($message);

        if ($this->isAlreadyProcessed($eventKey)) {
            $this->logger->info('Skipping duplicate OrderCreatedMessage', [
                'order_id' => $orderId,
                'event_key' => $eventKey,
            ]);
            return;
        }

        $this->logger->info('Processing OrderCreatedMessage', [
            'order_id' => $orderId,
            'customer_email' => $message->getCustomerEmail(),
            'occurred_on' => $message->getOccurredOn(),
        ]);

        try {
            $order = $this->orderRepository->findById(OrderId::fromString($orderId));

            if ($order === null) {
                $this->logger->warning('Order not found for OrderCreatedMessage', [
                    'order_id' => $orderId,
                ]);
                return;
            }

            $this->restaurantServiceClient->notifyOrderCreated(
                $orderId,
                $message->getCustomerEmail()
            );

            $this->markAsProcessed($eventKey);

            $this->logger->info('Successfully processed OrderCreatedMessage', [
                'order_id' => $orderId,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to process OrderCreatedMessage', [
                'order_id' => $orderId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function generateEventKey(OrderCreatedMessage $message): string
    {
        return sprintf(
            'order_created_%s_%s',
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
