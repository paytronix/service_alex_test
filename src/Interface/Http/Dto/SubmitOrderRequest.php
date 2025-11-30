<?php

declare(strict_types=1);

namespace App\Interface\Http\Dto;

final class SubmitOrderRequest
{
    public function __construct()
    {
    }

    public static function fromArray(array $data): self
    {
        return new self();
    }
}
