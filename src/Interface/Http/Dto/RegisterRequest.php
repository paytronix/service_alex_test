<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class RegisterRequest
{
    public function __construct(
        #[Assert\NotBlank(message: 'Email is required')]
        #[Assert\Email(message: 'Invalid email format')]
        public readonly string $email,

        #[Assert\NotBlank(message: 'Password is required')]
        #[Assert\Length(min: 6, max: 255, minMessage: 'Password must be at least 6 characters')]
        public readonly string $password,

        #[Assert\NotBlank(message: 'First name is required')]
        #[Assert\Length(max: 100, maxMessage: 'First name cannot exceed 100 characters')]
        public readonly string $firstName,

        #[Assert\NotBlank(message: 'Last name is required')]
        #[Assert\Length(max: 100, maxMessage: 'Last name cannot exceed 100 characters')]
        public readonly string $lastName,
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self(
            email: $data['email'] ?? '',
            password: $data['password'] ?? '',
            firstName: $data['first_name'] ?? '',
            lastName: $data['last_name'] ?? '',
        );
    }
}
