<?php

declare(strict_types=1);

namespace App\Domain\Entity;

use App\Domain\Event\DomainEvent;
use App\Domain\Event\OrderCancelledEvent;
use App\Domain\Event\OrderCreatedEvent;
use App\Domain\Event\OrderItemAddedEvent;
use App\Domain\Event\OrderSubmittedEvent;
use App\Domain\ValueObject\Money;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Domain\ValueObject\Timestamp;
use DomainException;
use InvalidArgumentException;

class Order
{
    private OrderId $id;
    private OrderCustomer $customer;
    private OrderStatus $status;
    private array $items;
    private Money $totalAmount;
    private ?string $notes;
    private ?string $cancellationReason;
    private Timestamp $createdAt;
    private Timestamp $updatedAt;
    private ?Timestamp $submittedAt;
    private ?Timestamp $cancelledAt;
    private ?string $userId;
    private array $domainEvents;

    private function __construct(
        OrderId $id,
        OrderCustomer $customer,
        OrderStatus $status,
        array $items,
        Money $totalAmount,
        ?string $notes,
        ?string $cancellationReason,
        Timestamp $createdAt,
        Timestamp $updatedAt,
        ?Timestamp $submittedAt,
        ?Timestamp $cancelledAt,
        ?string $userId = null
    ) {
        $this->id = $id;
        $this->customer = $customer;
        $this->status = $status;
        $this->items = $items;
        $this->totalAmount = $totalAmount;
        $this->notes = $notes;
        $this->cancellationReason = $cancellationReason;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
        $this->submittedAt = $submittedAt;
        $this->cancelledAt = $cancelledAt;
        $this->userId = $userId;
        $this->domainEvents = [];
    }

    public static function create(OrderCustomer $customer, string $currency = 'USD', ?string $notes = null, ?string $userId = null): self
    {
        $now = Timestamp::now();
        $orderId = OrderId::generate();

        $order = new self(
            $orderId,
            $customer,
            OrderStatus::draft(),
            [],
            Money::zero($currency),
            $notes,
            null,
            $now,
            $now,
            null,
            null,
            $userId
        );

        $order->recordEvent(new OrderCreatedEvent($orderId, $customer->email(), $now));

        return $order;
    }

    public static function reconstitute(
        OrderId $id,
        OrderCustomer $customer,
        OrderStatus $status,
        array $items,
        Money $totalAmount,
        ?string $notes,
        ?string $cancellationReason,
        Timestamp $createdAt,
        Timestamp $updatedAt,
        ?Timestamp $submittedAt,
        ?Timestamp $cancelledAt,
        ?string $userId = null
    ): self {
        return new self(
            $id,
            $customer,
            $status,
            $items,
            $totalAmount,
            $notes,
            $cancellationReason,
            $createdAt,
            $updatedAt,
            $submittedAt,
            $cancelledAt,
            $userId
        );
    }

    public function id(): OrderId
    {
        return $this->id;
    }

    public function customer(): OrderCustomer
    {
        return $this->customer;
    }

    public function status(): OrderStatus
    {
        return $this->status;
    }

    public function items(): array
    {
        return $this->items;
    }

    public function totalAmount(): Money
    {
        return $this->totalAmount;
    }

    public function notes(): ?string
    {
        return $this->notes;
    }

    public function cancellationReason(): ?string
    {
        return $this->cancellationReason;
    }

    public function createdAt(): Timestamp
    {
        return $this->createdAt;
    }

    public function updatedAt(): Timestamp
    {
        return $this->updatedAt;
    }

    public function submittedAt(): ?Timestamp
    {
        return $this->submittedAt;
    }

    public function cancelledAt(): ?Timestamp
    {
        return $this->cancelledAt;
    }

    public function userId(): ?string
    {
        return $this->userId;
    }

    public function ownedBy(string $userId): bool
    {
        return $this->userId !== null && $this->userId === $userId;
    }

    public function itemCount(): int
    {
        return count($this->items);
    }

    public function isEmpty(): bool
    {
        return empty($this->items);
    }

    public function addItem(
        string $productId,
        string $productName,
        int $quantity,
        Money $unitPrice,
        ?string $productSku = null,
        ?string $notes = null
    ): void {
        $this->ensureCanBeModified();

        if ($unitPrice->currency() !== $this->totalAmount->currency()) {
            throw new InvalidArgumentException(
                sprintf(
                    'Item currency (%s) must match order currency (%s)',
                    $unitPrice->currency(),
                    $this->totalAmount->currency()
                )
            );
        }

        foreach ($this->items as $index => $existingItem) {
            if ($existingItem->isSameProduct($productId)) {
                $newQuantity = $existingItem->quantity() + $quantity;
                $this->items[$index] = $existingItem->updateQuantity($newQuantity);
                $this->recalculateTotal();
                $this->touch();

                return;
            }
        }

        $item = OrderItem::create($productId, $productName, $quantity, $unitPrice, $productSku, $notes);
        $this->items[] = $item;
        $this->recalculateTotal();
        $this->touch();

        $this->recordEvent(new OrderItemAddedEvent(
            $this->id,
            $productId,
            $productName,
            $quantity,
            $unitPrice,
            Timestamp::now()
        ));
    }

    public function removeItem(string $itemId): void
    {
        $this->ensureCanBeModified();

        $found = false;
        foreach ($this->items as $index => $item) {
            if ($item->id() === $itemId) {
                unset($this->items[$index]);
                $found = true;
                break;
            }
        }

        if (!$found) {
            throw new InvalidArgumentException(sprintf('Item with ID %s not found in order', $itemId));
        }

        $this->items = array_values($this->items);
        $this->recalculateTotal();
        $this->touch();
    }

    public function updateItemQuantity(string $itemId, int $quantity): void
    {
        $this->ensureCanBeModified();

        $found = false;
        foreach ($this->items as $index => $item) {
            if ($item->id() === $itemId) {
                $this->items[$index] = $item->updateQuantity($quantity);
                $found = true;
                break;
            }
        }

        if (!$found) {
            throw new InvalidArgumentException(sprintf('Item with ID %s not found in order', $itemId));
        }

        $this->recalculateTotal();
        $this->touch();
    }

    public function clearItems(): void
    {
        $this->ensureCanBeModified();

        $this->items = [];
        $this->recalculateTotal();
        $this->touch();
    }

    public function submit(): void
    {
        if (!$this->status->isDraft()) {
            throw new DomainException(
                sprintf('Cannot submit order: order is in %s status, expected draft', $this->status->value())
            );
        }

        if ($this->isEmpty()) {
            throw new DomainException('Cannot submit order: order has no items');
        }

        $now = Timestamp::now();
        $this->status = OrderStatus::submitted();
        $this->submittedAt = $now;
        $this->touch();

        $this->recordEvent(new OrderSubmittedEvent(
            $this->id,
            $this->totalAmount,
            $this->itemCount(),
            $now
        ));
    }

    public function confirm(): void
    {
        if (!$this->status->isSubmitted()) {
            throw new DomainException(
                sprintf('Cannot confirm order: order is in %s status, expected submitted', $this->status->value())
            );
        }

        $this->status = OrderStatus::confirmed();
        $this->touch();
    }

    public function startProcessing(): void
    {
        if (!$this->status->isConfirmed()) {
            throw new DomainException(
                sprintf('Cannot start processing: order is in %s status, expected confirmed', $this->status->value())
            );
        }

        $this->status = OrderStatus::processing();
        $this->touch();
    }

    public function ship(): void
    {
        if (!$this->status->isProcessing()) {
            throw new DomainException(
                sprintf('Cannot ship order: order is in %s status, expected processing', $this->status->value())
            );
        }

        $this->status = OrderStatus::shipped();
        $this->touch();
    }

    public function deliver(): void
    {
        if (!$this->status->isShipped()) {
            throw new DomainException(
                sprintf('Cannot deliver order: order is in %s status, expected shipped', $this->status->value())
            );
        }

        $this->status = OrderStatus::delivered();
        $this->touch();
    }

    public function cancel(string $reason): void
    {
        if ($this->status->isFinal()) {
            throw new DomainException(
                sprintf('Cannot cancel order: order is in final status %s', $this->status->value())
            );
        }

        if (!$this->status->canTransitionTo(OrderStatus::cancelled())) {
            throw new DomainException(
                sprintf('Cannot cancel order from status %s', $this->status->value())
            );
        }

        if (empty($reason)) {
            throw new InvalidArgumentException('Cancellation reason cannot be empty');
        }

        $now = Timestamp::now();
        $this->status = OrderStatus::cancelled();
        $this->cancellationReason = $reason;
        $this->cancelledAt = $now;
        $this->touch();

        $this->recordEvent(new OrderCancelledEvent($this->id, $reason, $now));
    }

    public function refund(): void
    {
        if (!$this->status->isShipped() && !$this->status->isDelivered()) {
            throw new DomainException(
                sprintf('Cannot refund order: order is in %s status, expected shipped or delivered', $this->status->value())
            );
        }

        $this->status = OrderStatus::refunded();
        $this->touch();
    }

    public function updateCustomer(OrderCustomer $customer): void
    {
        $this->ensureCanBeModified();

        $this->customer = $customer;
        $this->touch();
    }

    public function updateNotes(?string $notes): void
    {
        $this->notes = $notes;
        $this->touch();
    }

    public function findItemById(string $itemId): ?OrderItem
    {
        foreach ($this->items as $item) {
            if ($item->id() === $itemId) {
                return $item;
            }
        }

        return null;
    }

    public function findItemByProductId(string $productId): ?OrderItem
    {
        foreach ($this->items as $item) {
            if ($item->isSameProduct($productId)) {
                return $item;
            }
        }

        return null;
    }

    public function canBeModified(): bool
    {
        return $this->status->isDraft();
    }

    public function canBeCancelled(): bool
    {
        return !$this->status->isFinal() && $this->status->canTransitionTo(OrderStatus::cancelled());
    }

    public function canBeSubmitted(): bool
    {
        return $this->status->isDraft() && !$this->isEmpty();
    }

    private function ensureCanBeModified(): void
    {
        if (!$this->canBeModified()) {
            throw new DomainException(
                sprintf('Cannot modify order: order is in %s status', $this->status->value())
            );
        }
    }

    private function recalculateTotal(): void
    {
        $total = Money::zero($this->totalAmount->currency());

        foreach ($this->items as $item) {
            $total = $total->add($item->totalPrice());
        }

        $this->totalAmount = $total;
    }

    private function touch(): void
    {
        $this->updatedAt = Timestamp::now();
    }

    protected function recordEvent(DomainEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }

    public function hasDomainEvents(): bool
    {
        return !empty($this->domainEvents);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id->value(),
            'customer' => $this->customer->toArray(),
            'status' => $this->status->value(),
            'items' => array_map(fn(OrderItem $item) => $item->toArray(), $this->items),
            'total_amount' => $this->totalAmount->amount(),
            'total_currency' => $this->totalAmount->currency(),
            'notes' => $this->notes,
            'cancellation_reason' => $this->cancellationReason,
            'created_at' => $this->createdAt->format(),
            'updated_at' => $this->updatedAt->format(),
            'submitted_at' => $this->submittedAt?->format(),
            'cancelled_at' => $this->cancelledAt?->format(),
            'user_id' => $this->userId,
        ];
    }
}
