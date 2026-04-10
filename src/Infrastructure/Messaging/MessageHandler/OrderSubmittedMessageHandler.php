<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\MessageHandler;

use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Infrastructure\ExternalService\PaymentServiceClientInterface;
use App\Infrastructure\ExternalService\POSServiceClientInterface;
use App\Infrastructure\Messaging\Message\OrderSubmittedMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class OrderSubmittedMessageHandler
{
    private OrderRepositoryInterface $orderRepository;
    private PaymentServiceClientInterface $paymentServiceClient;
    private POSServiceClientInterface $posServiceClient;
    private LoggerInterface $logger;
    private array $processedEventIds = [];

    public function __construct(
        OrderRepositoryInterface $orderRepository,
        PaymentServiceClientInterface $paymentServiceClient,
        POSServiceClientInterface $posServiceClient,
        LoggerInterface $logger
    ) {
        $this->orderRepository = $orderRepository;
        $this->paymentServiceClient = $paymentServiceClient;
        $this->posServiceClient = $posServiceClient;
        $this->logger = $logger;
    }

    public function __invoke(OrderSubmittedMessage $message): void
    {
        $orderId = $message->getOrderId();
        $eventKey = $this->generateEventKey($message);

        if ($this->isAlreadyProcessed($eventKey)) {
            $this->logger->info('Skipping duplicate OrderSubmittedMessage', [
                'order_id' => $orderId,
                'event_key' => $eventKey,
            ]);
            return;
        }

        $this->logger->info('Processing OrderSubmittedMessage', [
            'order_id' => $orderId,
            'total_amount' => $message->getTotalAmount(),
            'total_currency' => $message->getTotalCurrency(),
            'item_count' => $message->getItemCount(),
            'occurred_on' => $message->getOccurredOn(),
        ]);

        try {
            $order = $this->orderRepository->findById(OrderId::fromString($orderId));

            if ($order === null) {
                $this->logger->warning('Order not found for OrderSubmittedMessage', [
                    'order_id' => $orderId,
                ]);
                return;
            }

            $this->paymentServiceClient->initiatePayment(
                $orderId,
                $message->getTotalAmount(),
                $message->getTotalCurrency()
            );

            $this->posServiceClient->sendOrderToPOS(
                $orderId,
                $message->getItemCount()
            );

            $this->markAsProcessed($eventKey);

            $this->logger->info('Successfully processed OrderSubmittedMessage', [
                'order_id' => $orderId,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('Failed to process OrderSubmittedMessage', [
                'order_id' => $orderId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function generateEventKey(OrderSubmittedMessage $message): string
    {
        return sprintf(
            'order_submitted_%s_%s',
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
