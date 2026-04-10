<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MongoDB\Document;

use App\Domain\Entity\User;
use App\Domain\ValueObject\Timestamp;
use App\Domain\ValueObject\UserId;
use DateTimeImmutable;

class UserDocument
{
    private string $id;
    private string $email;
    private string $password;
    private array $roles;
    private string $firstName;
    private string $lastName;
    private bool $isActive;
    private DateTimeImmutable $createdAt;
    private DateTimeImmutable $updatedAt;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): void
    {
        $this->email = $email;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): void
    {
        $this->password = $password;
    }

    public function getRoles(): array
    {
        return $this->roles;
    }

    public function setRoles(array $roles): void
    {
        $this->roles = $roles;
    }

    public function getFirstName(): string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): void
    {
        $this->firstName = $firstName;
    }

    public function getLastName(): string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): void
    {
        $this->lastName = $lastName;
    }

    public function getIsActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): void
    {
        $this->isActive = $isActive;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTimeImmutable $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTimeImmutable $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public static function fromDomainEntity(User $user): self
    {
        $document = new self();
        $document->setId($user->id()->value());
        $document->setEmail($user->email());
        $document->setPassword($user->getPassword());
        $document->setRoles($user->getRoles());
        $document->setFirstName($user->firstName());
        $document->setLastName($user->lastName());
        $document->setIsActive($user->isActive());
        $document->setCreatedAt($user->createdAt()->value());
        $document->setUpdatedAt($user->updatedAt()->value());

        return $document;
    }

    public function toDomainEntity(): User
    {
        return User::reconstitute(
            UserId::fromString($this->id),
            $this->email,
            $this->password,
            $this->roles,
            $this->firstName,
            $this->lastName,
            $this->isActive,
            Timestamp::fromDateTime($this->createdAt),
            Timestamp::fromDateTime($this->updatedAt)
        );
    }
}
