<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class CreateOrderRequest
{
    public function __construct(
        #[Assert\NotBlank(message: 'Customer email is required')]
        #[Assert\Email(message: 'Invalid email format')]
        public readonly string $customerEmail,

        #[Assert\NotBlank(message: 'Customer first name is required')]
        #[Assert\Length(max: 100, maxMessage: 'First name cannot exceed 100 characters')]
        public readonly string $customerFirstName,

        #[Assert\NotBlank(message: 'Customer last name is required')]
        #[Assert\Length(max: 100, maxMessage: 'Last name cannot exceed 100 characters')]
        public readonly string $customerLastName,

        #[Assert\Length(max: 20, maxMessage: 'Phone number cannot exceed 20 characters')]
        public readonly ?string $customerPhone = null,

        #[Assert\Length(max: 255, maxMessage: 'Company name cannot exceed 255 characters')]
        public readonly ?string $customerCompany = null,

        #[Assert\Length(max: 255, maxMessage: 'Address line 1 cannot exceed 255 characters')]
        public readonly ?string $customerAddressLine1 = null,

        #[Assert\Length(max: 255, maxMessage: 'Address line 2 cannot exceed 255 characters')]
        public readonly ?string $customerAddressLine2 = null,

        #[Assert\Length(max: 100, maxMessage: 'City cannot exceed 100 characters')]
        public readonly ?string $customerCity = null,

        #[Assert\Length(max: 100, maxMessage: 'State cannot exceed 100 characters')]
        public readonly ?string $customerState = null,

        #[Assert\Length(max: 20, maxMessage: 'Postal code cannot exceed 20 characters')]
        public readonly ?string $customerPostalCode = null,

        #[Assert\Length(max: 2, maxMessage: 'Country must be a 2-letter ISO code')]
        public readonly ?string $customerCountry = null,

        #[Assert\Length(exactly: 3, exactMessage: 'Currency must be a 3-letter ISO code')]
        #[Assert\Regex(pattern: '/^[A-Z]{3}$/', message: 'Currency must be a valid 3-letter ISO code')]
        public readonly string $currency = 'USD',

        #[Assert\Length(max: 1000, maxMessage: 'Notes cannot exceed 1000 characters')]
        public readonly ?string $notes = null,

        #[Assert\All([
            new Assert\Collection([
                'fields' => [
                    'product_id' => [
                        new Assert\NotBlank(message: 'Product ID is required'),
                        new Assert\Type('string'),
                    ],
                    'product_name' => [
                        new Assert\NotBlank(message: 'Product name is required'),
                        new Assert\Type('string'),
                        new Assert\Length(max: 255),
                    ],
                    'quantity' => [
                        new Assert\NotBlank(message: 'Quantity is required'),
                        new Assert\Type('integer'),
                        new Assert\Positive(message: 'Quantity must be positive'),
                        new Assert\LessThanOrEqual(10000, message: 'Quantity cannot exceed 10000'),
                    ],
                    'unit_price' => [
                        new Assert\NotBlank(message: 'Unit price is required'),
                        new Assert\Type('integer'),
                        new Assert\PositiveOrZero(message: 'Unit price must be non-negative'),
                    ],
                    'product_sku' => new Assert\Optional([
                        new Assert\Type('string'),
                        new Assert\Length(max: 100),
                    ]),
                    'notes' => new Assert\Optional([
                        new Assert\Type('string'),
                        new Assert\Length(max: 500),
                    ]),
                ],
                'allowExtraFields' => false,
            ]),
        ])]
        public readonly array $items = [],
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self(
            customerEmail: $data['customer_email'] ?? '',
            customerFirstName: $data['customer_first_name'] ?? '',
            customerLastName: $data['customer_last_name'] ?? '',
            customerPhone: $data['customer_phone'] ?? null,
            customerCompany: $data['customer_company'] ?? null,
            customerAddressLine1: $data['customer_address_line_1'] ?? null,
            customerAddressLine2: $data['customer_address_line_2'] ?? null,
            customerCity: $data['customer_city'] ?? null,
            customerState: $data['customer_state'] ?? null,
            customerPostalCode: $data['customer_postal_code'] ?? null,
            customerCountry: $data['customer_country'] ?? null,
            currency: $data['currency'] ?? 'USD',
            notes: $data['notes'] ?? null,
            items: $data['items'] ?? [],
        );
    }
}
