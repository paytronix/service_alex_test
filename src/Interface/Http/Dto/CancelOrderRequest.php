<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class CancelOrderRequest
{
    public function __construct(
        #[Assert\NotBlank(message: 'Cancellation reason is required')]
        #[Assert\Length(
            min: 5,
            max: 1000,
            minMessage: 'Cancellation reason must be at least 5 characters',
            maxMessage: 'Cancellation reason cannot exceed 1000 characters'
        )]
        public readonly string $reason,
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self(
            reason: $data['reason'] ?? '',
        );
    }
}
