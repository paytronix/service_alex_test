<?php

declare(strict_types=1);

namespace App\Application\Command\Handler;

use App\Application\Command\CreateOrderCommand;
use App\Application\Event\OrderCreatedEvent;
use App\Application\Exception\OrderValidationException;
use App\Application\Service\OrderValidationServiceInterface;
use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use Psr\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateOrderHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderValidationServiceInterface $validationService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    public function __invoke(CreateOrderCommand $command): OrderId
    {
        $payload = $this->buildPayloadFromCommand($command);
        $this->validationService->validateCreate($payload);

        $customer = OrderCustomer::create(
            email: $command->customerEmail,
            firstName: $command->customerFirstName,
            lastName: $command->customerLastName,
            phone: $command->customerPhone,
            company: $command->customerCompany,
            addressLine1: $command->customerAddressLine1,
            addressLine2: $command->customerAddressLine2,
            city: $command->customerCity,
            state: $command->customerState,
            postalCode: $command->customerPostalCode,
            country: $command->customerCountry,
        );

        $order = Order::create($customer, $command->currency, $command->notes);

        foreach ($command->items as $item) {
            $unitPrice = Money::create(
                (int) ($item['unit_price'] ?? 0),
                $command->currency
            );

            $order->addItem(
                productId: $item['product_id'],
                productName: $item['product_name'] ?? 'Unknown Product',
                quantity: (int) ($item['quantity'] ?? 1),
                unitPrice: $unitPrice,
                productSku: $item['product_sku'] ?? null,
                notes: $item['notes'] ?? null,
            );
        }

        $this->orderRepository->save($order);

        $domainEvents = $order->pullDomainEvents();
        foreach ($domainEvents as $domainEvent) {
            if ($domainEvent instanceof \App\Domain\Event\OrderCreatedEvent) {
                $applicationEvent = OrderCreatedEvent::fromDomainEvent($domainEvent);
                $this->eventDispatcher->dispatch($applicationEvent);
            }
        }

        return $order->id();
    }

    private function buildPayloadFromCommand(CreateOrderCommand $command): array
    {
        return [
            'customer_email' => $command->customerEmail,
            'customer_first_name' => $command->customerFirstName,
            'customer_last_name' => $command->customerLastName,
            'customer_phone' => $command->customerPhone,
            'customer_company' => $command->customerCompany,
            'customer_address_line_1' => $command->customerAddressLine1,
            'customer_address_line_2' => $command->customerAddressLine2,
            'customer_city' => $command->customerCity,
            'customer_state' => $command->customerState,
            'customer_postal_code' => $command->customerPostalCode,
            'customer_country' => $command->customerCountry,
            'currency' => $command->currency,
            'notes' => $command->notes,
            'items' => $command->items,
        ];
    }
}
