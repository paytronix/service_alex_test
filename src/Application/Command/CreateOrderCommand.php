<?php

declare(strict_types=1);

namespace App\Application\Command;

final readonly class CreateOrderCommand
{
    public function __construct(
        public string $customerEmail,
        public string $customerFirstName,
        public string $customerLastName,
        public ?string $customerPhone = null,
        public ?string $customerCompany = null,
        public ?string $customerAddressLine1 = null,
        public ?string $customerAddressLine2 = null,
        public ?string $customerCity = null,
        public ?string $customerState = null,
        public ?string $customerPostalCode = null,
        public ?string $customerCountry = null,
        public string $currency = 'USD',
        public ?string $notes = null,
        public array $items = [],
    ) {
    }
}
