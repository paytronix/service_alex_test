<?php

declare(strict_types=1);

namespace App\Domain\Repository;

use App\Domain\Entity\Order;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;

interface OrderRepositoryInterface
{
    public function save(Order $order): void;

    public function findById(OrderId $id): ?Order;

    public function remove(Order $order): void;

    public function findByCustomerEmail(string $email): array;

    public function findByUserId(string $userId): array;

    public function findByStatus(OrderStatus $status): array;

    public function findAll(int $limit = 100, int $offset = 0): array;

    public function count(): int;

    public function countByStatus(OrderStatus $status): int;

    public function nextIdentity(): OrderId;
}
