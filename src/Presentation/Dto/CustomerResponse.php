<?php

declare(strict_types=1);

namespace App\Presentation\Dto;

final readonly class CustomerResponse
{
    public function __construct(
        public string $email,
        public string $firstName,
        public string $lastName,
        public ?string $phone,
        public ?string $company,
        public ?string $addressLine1,
        public ?string $addressLine2,
        public ?string $city,
        public ?string $state,
        public ?string $postalCode,
        public ?string $country,
    ) {
    }
}
