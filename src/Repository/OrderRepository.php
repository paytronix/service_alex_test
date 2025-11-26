<?php

namespace App\Repository;

use App\Document\Order;
use Doctrine\Bundle\MongoDBBundle\ManagerRegistry;
use Doctrine\Bundle\MongoDBBundle\Repository\ServiceDocumentRepository;

/**
 * @extends ServiceDocumentRepository<Order>
 *
 * @method Order|null find($id, $lockMode = null, $lockVersion = null)
 * @method Order|null findOneBy(array $criteria, array $orderBy = null)
 * @method Order[]    findAll()
 * @method Order[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class OrderRepository extends ServiceDocumentRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Order::class);
    }

    public function save(Order $order, bool $flush = false): void
    {
        $this->getDocumentManager()->persist($order);

        if ($flush) {
            $this->getDocumentManager()->flush();
        }
    }

    public function remove(Order $order, bool $flush = false): void
    {
        $this->getDocumentManager()->remove($order);

        if ($flush) {
            $this->getDocumentManager()->flush();
        }
    }

    /**
     * @return Order[]
     */
    public function findByStatus(string $status): array
    {
        return $this->findBy(['status' => $status]);
    }

    /**
     * @return Order[]
     */
    public function findRecentOrders(int $limit = 10): array
    {
        return $this->createQueryBuilder()
            ->sort('createdAt', 'DESC')
            ->limit($limit)
            ->getQuery()
            ->execute()
            ->toArray();
    }
}
