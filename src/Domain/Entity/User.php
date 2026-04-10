<?php

declare(strict_types=1);

namespace App\Domain\Entity;

use App\Domain\ValueObject\Timestamp;
use App\Domain\ValueObject\UserId;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    private UserId $id;
    private string $email;
    private string $password;
    private array $roles;
    private string $firstName;
    private string $lastName;
    private bool $isActive;
    private Timestamp $createdAt;
    private Timestamp $updatedAt;

    private function __construct(
        UserId $id,
        string $email,
        string $password,
        array $roles,
        string $firstName,
        string $lastName,
        bool $isActive,
        Timestamp $createdAt,
        Timestamp $updatedAt
    ) {
        $this->id = $id;
        $this->email = $email;
        $this->password = $password;
        $this->roles = $roles;
        $this->firstName = $firstName;
        $this->lastName = $lastName;
        $this->isActive = $isActive;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public static function create(
        string $email,
        string $hashedPassword,
        string $firstName,
        string $lastName,
        array $roles = ['ROLE_USER']
    ): self {
        $now = Timestamp::now();

        return new self(
            UserId::generate(),
            $email,
            $hashedPassword,
            $roles,
            $firstName,
            $lastName,
            true,
            $now,
            $now
        );
    }

    public static function reconstitute(
        UserId $id,
        string $email,
        string $password,
        array $roles,
        string $firstName,
        string $lastName,
        bool $isActive,
        Timestamp $createdAt,
        Timestamp $updatedAt
    ): self {
        return new self($id, $email, $password, $roles, $firstName, $lastName, $isActive, $createdAt, $updatedAt);
    }

    public function id(): UserId
    {
        return $this->id;
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

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function createdAt(): Timestamp
    {
        return $this->createdAt;
    }

    public function updatedAt(): Timestamp
    {
        return $this->updatedAt;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function eraseCredentials(): void
    {
    }

    public function promote(string $role): void
    {
        if (!in_array($role, $this->roles, true)) {
            $this->roles[] = $role;
            $this->touch();
        }
    }

    public function demote(string $role): void
    {
        $key = array_search($role, $this->roles, true);
        if ($key !== false) {
            unset($this->roles[$key]);
            $this->roles = array_values($this->roles);
            $this->touch();
        }
    }

    public function deactivate(): void
    {
        $this->isActive = false;
        $this->touch();
    }

    public function activate(): void
    {
        $this->isActive = true;
        $this->touch();
    }

    private function touch(): void
    {
        $this->updatedAt = Timestamp::now();
    }
}
