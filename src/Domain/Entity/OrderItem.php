<?php

declare(strict_types=1);

namespace App\Domain\Entity;

use App\Domain\ValueObject\Money;
use InvalidArgumentException;

final class OrderItem
{
    private string $id;
    private string $productId;
    private string $productName;
    private ?string $productSku;
    private int $quantity;
    private Money $unitPrice;
    private ?string $notes;

    private function __construct(
        string $id,
        string $productId,
        string $productName,
        ?string $productSku,
        int $quantity,
        Money $unitPrice,
        ?string $notes = null
    ) {
        $this->id = $id;
        $this->setProductId($productId);
        $this->setProductName($productName);
        $this->productSku = $productSku;
        $this->setQuantity($quantity);
        $this->unitPrice = $unitPrice;
        $this->notes = $notes;
    }

    public static function create(
        string $productId,
        string $productName,
        int $quantity,
        Money $unitPrice,
        ?string $productSku = null,
        ?string $notes = null
    ): self {
        return new self(
            bin2hex(random_bytes(12)),
            $productId,
            $productName,
            $productSku,
            $quantity,
            $unitPrice,
            $notes
        );
    }

    public static function reconstitute(
        string $id,
        string $productId,
        string $productName,
        ?string $productSku,
        int $quantity,
        Money $unitPrice,
        ?string $notes = null
    ): self {
        return new self(
            $id,
            $productId,
            $productName,
            $productSku,
            $quantity,
            $unitPrice,
            $notes
        );
    }

    private function setProductId(string $productId): void
    {
        if (empty($productId)) {
            throw new InvalidArgumentException('Product ID cannot be empty');
        }

        $this->productId = $productId;
    }

    private function setProductName(string $productName): void
    {
        if (empty($productName)) {
            throw new InvalidArgumentException('Product name cannot be empty');
        }

        if (strlen($productName) > 255) {
            throw new InvalidArgumentException('Product name cannot exceed 255 characters');
        }

        $this->productName = $productName;
    }

    private function setQuantity(int $quantity): void
    {
        if ($quantity < 1) {
            throw new InvalidArgumentException('Quantity must be at least 1');
        }

        if ($quantity > 10000) {
            throw new InvalidArgumentException('Quantity cannot exceed 10000');
        }

        $this->quantity = $quantity;
    }

    public function id(): string
    {
        return $this->id;
    }

    public function productId(): string
    {
        return $this->productId;
    }

    public function productName(): string
    {
        return $this->productName;
    }

    public function productSku(): ?string
    {
        return $this->productSku;
    }

    public function quantity(): int
    {
        return $this->quantity;
    }

    public function unitPrice(): Money
    {
        return $this->unitPrice;
    }

    public function notes(): ?string
    {
        return $this->notes;
    }

    public function totalPrice(): Money
    {
        return $this->unitPrice->multiply($this->quantity);
    }

    public function updateQuantity(int $quantity): self
    {
        $new = clone $this;
        $new->setQuantity($quantity);

        return $new;
    }

    public function updateUnitPrice(Money $unitPrice): self
    {
        $new = clone $this;
        $new->unitPrice = $unitPrice;

        return $new;
    }

    public function updateNotes(?string $notes): self
    {
        $new = clone $this;
        $new->notes = $notes;

        return $new;
    }

    public function isSameProduct(string $productId): bool
    {
        return $this->productId === $productId;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'product_sku' => $this->productSku,
            'quantity' => $this->quantity,
            'unit_price_amount' => $this->unitPrice->amount(),
            'unit_price_currency' => $this->unitPrice->currency(),
            'total_price_amount' => $this->totalPrice()->amount(),
            'total_price_currency' => $this->totalPrice()->currency(),
            'notes' => $this->notes,
        ];
    }
}
