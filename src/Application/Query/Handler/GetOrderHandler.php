<?php

declare(strict_types=1);

namespace App\Application\Query\Handler;

use App\Application\Query\GetOrderQuery;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;

final class GetOrderHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
    ) {
    }

    public function __invoke(GetOrderQuery $query): ?Order
    {
        $orderId = OrderId::fromString($query->orderId);

        return $this->orderRepository->findById($orderId);
    }
}
