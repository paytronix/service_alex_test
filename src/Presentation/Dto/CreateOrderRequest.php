<?php

declare(strict_types=1);

namespace App\Presentation\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class CreateOrderRequest
{
    #[Assert\NotBlank(message: 'Customer email is required')]
    #[Assert\Email(message: 'Invalid email format')]
    public string $customerEmail;

    #[Assert\NotBlank(message: 'Customer first name is required')]
    #[Assert\Length(max: 100, maxMessage: 'First name cannot exceed 100 characters')]
    public string $customerFirstName;

    #[Assert\NotBlank(message: 'Customer last name is required')]
    #[Assert\Length(max: 100, maxMessage: 'Last name cannot exceed 100 characters')]
    public string $customerLastName;

    #[Assert\Length(max: 20, maxMessage: 'Phone cannot exceed 20 characters')]
    public ?string $customerPhone = null;

    #[Assert\Length(max: 100, maxMessage: 'Company cannot exceed 100 characters')]
    public ?string $customerCompany = null;

    #[Assert\Length(max: 255, maxMessage: 'Address line 1 cannot exceed 255 characters')]
    public ?string $customerAddressLine1 = null;

    #[Assert\Length(max: 255, maxMessage: 'Address line 2 cannot exceed 255 characters')]
    public ?string $customerAddressLine2 = null;

    #[Assert\Length(max: 100, maxMessage: 'City cannot exceed 100 characters')]
    public ?string $customerCity = null;

    #[Assert\Length(max: 100, maxMessage: 'State cannot exceed 100 characters')]
    public ?string $customerState = null;

    #[Assert\Length(max: 20, maxMessage: 'Postal code cannot exceed 20 characters')]
    public ?string $customerPostalCode = null;

    #[Assert\Length(max: 2, maxMessage: 'Country must be a 2-letter ISO code')]
    public ?string $customerCountry = null;

    #[Assert\NotBlank(message: 'Currency is required')]
    #[Assert\Length(exactly: 3, exactMessage: 'Currency must be a 3-letter ISO code')]
    public string $currency = 'USD';

    #[Assert\Length(max: 1000, maxMessage: 'Notes cannot exceed 1000 characters')]
    public ?string $notes = null;

    #[Assert\Valid]
    public array $items = [];
}
