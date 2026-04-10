<?php

declare(strict_types=1);

namespace App\Presentation\Dto;

final readonly class MoneyResponse
{
    public function __construct(
        public int $amount,
        public string $currency,
        public float $formatted,
    ) {
    }
}
