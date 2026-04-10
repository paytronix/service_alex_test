<?php

declare(strict_types=1);

namespace App\Domain\ValueObject;

use InvalidArgumentException;

final class UserId
{
    private string $value;

    private function __construct(string $value)
    {
        if (empty($value)) {
            throw new InvalidArgumentException('UserId cannot be empty');
        }

        $this->value = $value;
    }

    public static function generate(): self
    {
        return new self(bin2hex(random_bytes(12)));
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function equals(UserId $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
