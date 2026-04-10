<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MongoDB\Document;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Entity\OrderItem;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Domain\ValueObject\Timestamp;
use DateTimeImmutable;

class OrderDocument
{
    private string $id;
    private array $customer;
    private string $status;
    private array $items;
    private int $totalAmountValue;
    private string $totalAmountCurrency;
    private ?string $notes;
    private ?string $cancellationReason;
    private DateTimeImmutable $createdAt;
    private DateTimeImmutable $updatedAt;
    private ?DateTimeImmutable $submittedAt;
    private ?DateTimeImmutable $cancelledAt;
    private ?string $userId = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getCustomer(): array
    {
        return $this->customer;
    }

    public function setCustomer(array $customer): void
    {
        $this->customer = $customer;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getItems(): array
    {
        return $this->items;
    }

    public function setItems(array $items): void
    {
        $this->items = $items;
    }

    public function getTotalAmountValue(): int
    {
        return $this->totalAmountValue;
    }

    public function setTotalAmountValue(int $totalAmountValue): void
    {
        $this->totalAmountValue = $totalAmountValue;
    }

    public function getTotalAmountCurrency(): string
    {
        return $this->totalAmountCurrency;
    }

    public function setTotalAmountCurrency(string $totalAmountCurrency): void
    {
        $this->totalAmountCurrency = $totalAmountCurrency;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getCancellationReason(): ?string
    {
        return $this->cancellationReason;
    }

    public function setCancellationReason(?string $cancellationReason): void
    {
        $this->cancellationReason = $cancellationReason;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTimeImmutable $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTimeImmutable $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getSubmittedAt(): ?DateTimeImmutable
    {
        return $this->submittedAt;
    }

    public function setSubmittedAt(?DateTimeImmutable $submittedAt): void
    {
        $this->submittedAt = $submittedAt;
    }

    public function getCancelledAt(): ?DateTimeImmutable
    {
        return $this->cancelledAt;
    }

    public function setCancelledAt(?DateTimeImmutable $cancelledAt): void
    {
        $this->cancelledAt = $cancelledAt;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public static function fromDomainEntity(Order $order): self
    {
        $document = new self();
        $document->setId($order->id()->value());
        $document->setCustomer(self::customerToArray($order->customer()));
        $document->setStatus($order->status()->value());
        $document->setItems(self::itemsToArray($order->items()));
        $document->setTotalAmountValue($order->totalAmount()->amount());
        $document->setTotalAmountCurrency($order->totalAmount()->currency());
        $document->setNotes($order->notes());
        $document->setCancellationReason($order->cancellationReason());
        $document->setCreatedAt($order->createdAt()->value());
        $document->setUpdatedAt($order->updatedAt()->value());
        $document->setSubmittedAt($order->submittedAt()?->value());
        $document->setCancelledAt($order->cancelledAt()?->value());
        $document->setUserId($order->userId());

        return $document;
    }

    public function toDomainEntity(): Order
    {
        $customer = self::arrayToCustomer($this->customer);
        $items = self::arrayToItems($this->items);

        return Order::reconstitute(
            OrderId::fromString($this->id),
            $customer,
            OrderStatus::fromString($this->status),
            $items,
            Money::create($this->totalAmountValue, $this->totalAmountCurrency),
            $this->notes,
            $this->cancellationReason,
            Timestamp::fromDateTime($this->createdAt),
            Timestamp::fromDateTime($this->updatedAt),
            $this->submittedAt ? Timestamp::fromDateTime($this->submittedAt) : null,
            $this->cancelledAt ? Timestamp::fromDateTime($this->cancelledAt) : null,
            $this->userId
        );
    }

    private static function customerToArray(OrderCustomer $customer): array
    {
        return [
            'email' => $customer->email(),
            'first_name' => $customer->firstName(),
            'last_name' => $customer->lastName(),
            'phone' => $customer->phone(),
            'company' => $customer->company(),
            'address_line_1' => $customer->addressLine1(),
            'address_line_2' => $customer->addressLine2(),
            'city' => $customer->city(),
            'state' => $customer->state(),
            'postal_code' => $customer->postalCode(),
            'country' => $customer->country(),
        ];
    }

    private static function arrayToCustomer(array $data): OrderCustomer
    {
        return OrderCustomer::create(
            $data['email'],
            $data['first_name'],
            $data['last_name'],
            $data['phone'] ?? null,
            $data['company'] ?? null,
            $data['address_line_1'] ?? null,
            $data['address_line_2'] ?? null,
            $data['city'] ?? null,
            $data['state'] ?? null,
            $data['postal_code'] ?? null,
            $data['country'] ?? null
        );
    }

    private static function itemsToArray(array $items): array
    {
        return array_map(function (OrderItem $item) {
            return [
                'id' => $item->id(),
                'product_id' => $item->productId(),
                'product_name' => $item->productName(),
                'product_sku' => $item->productSku(),
                'quantity' => $item->quantity(),
                'unit_price_amount' => $item->unitPrice()->amount(),
                'unit_price_currency' => $item->unitPrice()->currency(),
                'notes' => $item->notes(),
            ];
        }, $items);
    }

    private static function arrayToItems(array $data): array
    {
        return array_map(function (array $itemData) {
            return OrderItem::reconstitute(
                $itemData['id'],
                $itemData['product_id'],
                $itemData['product_name'],
                $itemData['product_sku'] ?? null,
                $itemData['quantity'],
                Money::create($itemData['unit_price_amount'], $itemData['unit_price_currency']),
                $itemData['notes'] ?? null
            );
        }, $data);
    }
}
