<?php

declare(strict_types=1);

namespace App\Infrastructure\Messaging\EventSubscriber;

use App\Domain\Event\OrderCancelledEvent;
use App\Domain\Event\OrderCreatedEvent;
use App\Domain\Event\OrderSubmittedEvent;
use App\Infrastructure\Messaging\Message\OrderCancelledMessage;
use App\Infrastructure\Messaging\Message\OrderCreatedMessage;
use App\Infrastructure\Messaging\Message\OrderSubmittedMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Messenger\MessageBusInterface;

final class DomainEventSubscriber implements EventSubscriberInterface
{
    private MessageBusInterface $messageBus;
    private LoggerInterface $logger;

    public function __construct(MessageBusInterface $messageBus, LoggerInterface $logger)
    {
        $this->messageBus = $messageBus;
        $this->logger = $logger;
    }

    public static function getSubscribedEvents(): array
    {
        return [
            OrderCreatedEvent::class => 'onOrderCreated',
            OrderSubmittedEvent::class => 'onOrderSubmitted',
            OrderCancelledEvent::class => 'onOrderCancelled',
        ];
    }

    public function onOrderCreated(OrderCreatedEvent $event): void
    {
        $this->logger->info('DomainEventSubscriber: dispatching OrderCreatedMessage', [
            'order_id' => $event->orderId()->value(),
            'customer_email' => $event->customerEmail(),
        ]);

        $message = new OrderCreatedMessage(
            $event->orderId()->value(),
            $event->customerEmail(),
            $event->occurredOn()->format()
        );

        $this->messageBus->dispatch($message);
    }

    public function onOrderSubmitted(OrderSubmittedEvent $event): void
    {
        $this->logger->info('DomainEventSubscriber: dispatching OrderSubmittedMessage', [
            'order_id' => $event->orderId()->value(),
            'total_amount' => $event->totalAmount()->amount(),
            'item_count' => $event->itemCount(),
        ]);

        $message = new OrderSubmittedMessage(
            $event->orderId()->value(),
            $event->totalAmount()->amount(),
            $event->totalAmount()->currency(),
            $event->itemCount(),
            $event->occurredOn()->format()
        );

        $this->messageBus->dispatch($message);
    }

    public function onOrderCancelled(OrderCancelledEvent $event): void
    {
        $this->logger->info('DomainEventSubscriber: dispatching OrderCancelledMessage', [
            'order_id' => $event->orderId()->value(),
            'reason' => $event->reason(),
        ]);

        $message = new OrderCancelledMessage(
            $event->orderId()->value(),
            $event->reason(),
            $event->occurredOn()->format()
        );

        $this->messageBus->dispatch($message);
    }
}
