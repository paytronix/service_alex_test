<?php

declare(strict_types=1);

namespace App\Domain\ValueObject;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use InvalidArgumentException;

final class Timestamp
{
    private DateTimeImmutable $value;

    private function __construct(DateTimeImmutable $value)
    {
        $this->value = $value;
    }

    public static function now(): self
    {
        return new self(new DateTimeImmutable('now', new DateTimeZone('UTC')));
    }

    public static function fromDateTime(DateTimeInterface $dateTime): self
    {
        if ($dateTime instanceof DateTimeImmutable) {
            return new self($dateTime->setTimezone(new DateTimeZone('UTC')));
        }

        return new self(DateTimeImmutable::createFromMutable($dateTime)->setTimezone(new DateTimeZone('UTC')));
    }

    public static function fromString(string $value): self
    {
        try {
            $dateTime = new DateTimeImmutable($value, new DateTimeZone('UTC'));
        } catch (\Exception $e) {
            throw new InvalidArgumentException(sprintf('Invalid timestamp format: %s', $value));
        }

        return new self($dateTime);
    }

    public static function fromTimestamp(int $timestamp): self
    {
        $dateTime = (new DateTimeImmutable())->setTimestamp($timestamp)->setTimezone(new DateTimeZone('UTC'));

        return new self($dateTime);
    }

    public function value(): DateTimeImmutable
    {
        return $this->value;
    }

    public function timestamp(): int
    {
        return $this->value->getTimestamp();
    }

    public function format(string $format = DateTimeInterface::ATOM): string
    {
        return $this->value->format($format);
    }

    public function equals(Timestamp $other): bool
    {
        return $this->value->getTimestamp() === $other->value->getTimestamp();
    }

    public function isBefore(Timestamp $other): bool
    {
        return $this->value < $other->value;
    }

    public function isAfter(Timestamp $other): bool
    {
        return $this->value > $other->value;
    }

    public function addDays(int $days): self
    {
        return new self($this->value->modify(sprintf('+%d days', $days)));
    }

    public function addHours(int $hours): self
    {
        return new self($this->value->modify(sprintf('+%d hours', $hours)));
    }

    public function addMinutes(int $minutes): self
    {
        return new self($this->value->modify(sprintf('+%d minutes', $minutes)));
    }

    public function diffInSeconds(Timestamp $other): int
    {
        return abs($this->value->getTimestamp() - $other->value->getTimestamp());
    }

    public function diffInMinutes(Timestamp $other): int
    {
        return (int) floor($this->diffInSeconds($other) / 60);
    }

    public function diffInHours(Timestamp $other): int
    {
        return (int) floor($this->diffInSeconds($other) / 3600);
    }

    public function diffInDays(Timestamp $other): int
    {
        return (int) floor($this->diffInSeconds($other) / 86400);
    }

    public function __toString(): string
    {
        return $this->format();
    }
}
