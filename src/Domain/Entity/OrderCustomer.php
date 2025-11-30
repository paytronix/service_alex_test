<?php

declare(strict_types=1);

namespace App\Domain\Entity;

use InvalidArgumentException;

final class OrderCustomer
{
    private string $email;
    private string $firstName;
    private string $lastName;
    private ?string $phone;
    private ?string $company;
    private ?string $addressLine1;
    private ?string $addressLine2;
    private ?string $city;
    private ?string $state;
    private ?string $postalCode;
    private ?string $country;

    private function __construct(
        string $email,
        string $firstName,
        string $lastName,
        ?string $phone = null,
        ?string $company = null,
        ?string $addressLine1 = null,
        ?string $addressLine2 = null,
        ?string $city = null,
        ?string $state = null,
        ?string $postalCode = null,
        ?string $country = null
    ) {
        $this->setEmail($email);
        $this->setFirstName($firstName);
        $this->setLastName($lastName);
        $this->phone = $phone;
        $this->company = $company;
        $this->addressLine1 = $addressLine1;
        $this->addressLine2 = $addressLine2;
        $this->city = $city;
        $this->state = $state;
        $this->postalCode = $postalCode;
        $this->country = $country;
    }

    public static function create(
        string $email,
        string $firstName,
        string $lastName,
        ?string $phone = null,
        ?string $company = null,
        ?string $addressLine1 = null,
        ?string $addressLine2 = null,
        ?string $city = null,
        ?string $state = null,
        ?string $postalCode = null,
        ?string $country = null
    ): self {
        return new self(
            $email,
            $firstName,
            $lastName,
            $phone,
            $company,
            $addressLine1,
            $addressLine2,
            $city,
            $state,
            $postalCode,
            $country
        );
    }

    private function setEmail(string $email): void
    {
        if (empty($email)) {
            throw new InvalidArgumentException('Customer email cannot be empty');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException(sprintf('Invalid email format: %s', $email));
        }

        $this->email = $email;
    }

    private function setFirstName(string $firstName): void
    {
        if (empty($firstName)) {
            throw new InvalidArgumentException('Customer first name cannot be empty');
        }

        if (strlen($firstName) > 100) {
            throw new InvalidArgumentException('Customer first name cannot exceed 100 characters');
        }

        $this->firstName = $firstName;
    }

    private function setLastName(string $lastName): void
    {
        if (empty($lastName)) {
            throw new InvalidArgumentException('Customer last name cannot be empty');
        }

        if (strlen($lastName) > 100) {
            throw new InvalidArgumentException('Customer last name cannot exceed 100 characters');
        }

        $this->lastName = $lastName;
    }

    public function email(): string
    {
        return $this->email;
    }

    public function firstName(): string
    {
        return $this->firstName;
    }

    public function lastName(): string
    {
        return $this->lastName;
    }

    public function fullName(): string
    {
        return trim($this->firstName . ' ' . $this->lastName);
    }

    public function phone(): ?string
    {
        return $this->phone;
    }

    public function company(): ?string
    {
        return $this->company;
    }

    public function addressLine1(): ?string
    {
        return $this->addressLine1;
    }

    public function addressLine2(): ?string
    {
        return $this->addressLine2;
    }

    public function city(): ?string
    {
        return $this->city;
    }

    public function state(): ?string
    {
        return $this->state;
    }

    public function postalCode(): ?string
    {
        return $this->postalCode;
    }

    public function country(): ?string
    {
        return $this->country;
    }

    public function hasCompleteAddress(): bool
    {
        return !empty($this->addressLine1)
            && !empty($this->city)
            && !empty($this->postalCode)
            && !empty($this->country);
    }

    public function updateEmail(string $email): self
    {
        $new = clone $this;
        $new->setEmail($email);

        return $new;
    }

    public function updateName(string $firstName, string $lastName): self
    {
        $new = clone $this;
        $new->setFirstName($firstName);
        $new->setLastName($lastName);

        return $new;
    }

    public function updateAddress(
        ?string $addressLine1,
        ?string $addressLine2,
        ?string $city,
        ?string $state,
        ?string $postalCode,
        ?string $country
    ): self {
        $new = clone $this;
        $new->addressLine1 = $addressLine1;
        $new->addressLine2 = $addressLine2;
        $new->city = $city;
        $new->state = $state;
        $new->postalCode = $postalCode;
        $new->country = $country;

        return $new;
    }

    public function updatePhone(?string $phone): self
    {
        $new = clone $this;
        $new->phone = $phone;

        return $new;
    }

    public function updateCompany(?string $company): self
    {
        $new = clone $this;
        $new->company = $company;

        return $new;
    }

    public function toArray(): array
    {
        return [
            'email' => $this->email,
            'first_name' => $this->firstName,
            'last_name' => $this->lastName,
            'phone' => $this->phone,
            'company' => $this->company,
            'address_line_1' => $this->addressLine1,
            'address_line_2' => $this->addressLine2,
            'city' => $this->city,
            'state' => $this->state,
            'postal_code' => $this->postalCode,
            'country' => $this->country,
        ];
    }
}
