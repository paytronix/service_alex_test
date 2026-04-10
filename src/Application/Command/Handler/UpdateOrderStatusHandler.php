<?php

declare(strict_types=1);

namespace App\Application\Command\Handler;

use App\Application\Command\UpdateOrderStatusCommand;
use App\Application\Event\OrderStatusUpdatedEvent;
use App\Application\Exception\OrderValidationException;
use App\Application\Service\OrderValidationServiceInterface;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use DateTimeImmutable;
use Psr\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Messenger\MessageBusInterface;

final class UpdateOrderStatusHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderValidationServiceInterface $validationService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    public function __invoke(UpdateOrderStatusCommand $command): Order
    {
        $orderId = OrderId::fromString($command->orderId);
        $order = $this->orderRepository->findById($orderId);

        if ($order === null) {
            throw OrderValidationException::orderNotFound($command->orderId);
        }

        $previousStatus = $order->status()->value();
        $this->validationService->validateStatusTransition($previousStatus, $command->newStatus);

        $this->applyStatusTransition($order, $command->newStatus, $command->reason);

        $this->orderRepository->save($order);

        $event = new OrderStatusUpdatedEvent(
            orderId: $command->orderId,
            previousStatus: $previousStatus,
            newStatus: $command->newStatus,
            reason: $command->reason,
            occurredOn: new DateTimeImmutable(),
        );

        $this->eventDispatcher->dispatch($event);

        return $order;
    }

    private function applyStatusTransition(Order $order, string $newStatus, ?string $reason): void
    {
        match ($newStatus) {
            OrderStatus::SUBMITTED => $order->submit(),
            OrderStatus::CONFIRMED => $order->confirm(),
            OrderStatus::PROCESSING => $order->startProcessing(),
            OrderStatus::SHIPPED => $order->ship(),
            OrderStatus::DELIVERED => $order->deliver(),
            OrderStatus::CANCELLED => $order->cancel($reason ?? 'No reason provided'),
            OrderStatus::REFUNDED => $order->refund(),
            default => throw OrderValidationException::invalidStatus($order->status()->value(), $newStatus),
        };
    }
}
