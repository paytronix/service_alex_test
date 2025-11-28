<?php

declare(strict_types=1);

namespace App\Domain\Repository;

use App\Domain\Entity\OrderItem;

interface OrderItemRepositoryInterface
{
    public function save(OrderItem $item): void;

    public function findById(string $id): ?OrderItem;

    public function remove(OrderItem $item): void;

    public function findByProductId(string $productId): array;

    public function findAll(int $limit = 100, int $offset = 0): array;

    public function count(): int;
}
