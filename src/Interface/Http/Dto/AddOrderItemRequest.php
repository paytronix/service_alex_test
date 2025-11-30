<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class AddOrderItemRequest
{
    public function __construct(
        #[Assert\NotBlank(message: 'Product ID is required')]
        #[Assert\Length(max: 255, maxMessage: 'Product ID cannot exceed 255 characters')]
        public readonly string $productId,

        #[Assert\NotBlank(message: 'Product name is required')]
        #[Assert\Length(max: 255, maxMessage: 'Product name cannot exceed 255 characters')]
        public readonly string $productName,

        #[Assert\NotBlank(message: 'Quantity is required')]
        #[Assert\Positive(message: 'Quantity must be positive')]
        #[Assert\LessThanOrEqual(10000, message: 'Quantity cannot exceed 10000')]
        public readonly int $quantity,

        #[Assert\NotBlank(message: 'Unit price is required')]
        #[Assert\PositiveOrZero(message: 'Unit price must be non-negative')]
        public readonly int $unitPrice,

        #[Assert\Length(max: 100, maxMessage: 'Product SKU cannot exceed 100 characters')]
        public readonly ?string $productSku = null,

        #[Assert\Length(max: 500, maxMessage: 'Notes cannot exceed 500 characters')]
        public readonly ?string $notes = null,
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self(
            productId: $data['product_id'] ?? '',
            productName: $data['product_name'] ?? '',
            quantity: (int) ($data['quantity'] ?? 0),
            unitPrice: (int) ($data['unit_price'] ?? 0),
            productSku: $data['product_sku'] ?? null,
            notes: $data['notes'] ?? null,
        );
    }
}
