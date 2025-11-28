<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MongoDB\Repository;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use App\Infrastructure\Persistence\MongoDB\Document\OrderDocument;
use Doctrine\ODM\MongoDB\DocumentManager;
use Doctrine\ODM\MongoDB\Repository\DocumentRepository;

class OrderRepository implements OrderRepositoryInterface
{
    private DocumentManager $documentManager;

    public function __construct(DocumentManager $documentManager)
    {
        $this->documentManager = $documentManager;
    }

    public function save(Order $order): void
    {
        $document = OrderDocument::fromDomainEntity($order);

        $existingDocument = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->find($order->id()->value());

        if ($existingDocument !== null) {
            $this->documentManager->detach($existingDocument);
        }

        $this->documentManager->persist($document);
        $this->documentManager->flush();
    }

    public function findById(OrderId $id): ?Order
    {
        $document = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->find($id->value());

        if ($document === null) {
            return null;
        }

        return $document->toDomainEntity();
    }

    public function remove(Order $order): void
    {
        $document = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->find($order->id()->value());

        if ($document !== null) {
            $this->documentManager->remove($document);
            $this->documentManager->flush();
        }
    }

    public function findByCustomerEmail(string $email): array
    {
        $documents = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->findBy(['customer.email' => $email]);

        return array_map(
            fn(OrderDocument $document) => $document->toDomainEntity(),
            $documents
        );
    }

    public function findByStatus(OrderStatus $status): array
    {
        $documents = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->findBy(['status' => $status->value()]);

        return array_map(
            fn(OrderDocument $document) => $document->toDomainEntity(),
            $documents
        );
    }

    public function findAll(int $limit = 100, int $offset = 0): array
    {
        $documents = $this->documentManager
            ->getRepository(OrderDocument::class)
            ->findBy([], ['createdAt' => 'DESC'], $limit, $offset);

        return array_map(
            fn(OrderDocument $document) => $document->toDomainEntity(),
            $documents
        );
    }

    public function count(): int
    {
        return $this->documentManager
            ->getRepository(OrderDocument::class)
            ->createQueryBuilder()
            ->count()
            ->getQuery()
            ->execute();
    }

    public function countByStatus(OrderStatus $status): int
    {
        return $this->documentManager
            ->getRepository(OrderDocument::class)
            ->createQueryBuilder()
            ->field('status')->equals($status->value())
            ->count()
            ->getQuery()
            ->execute();
    }

    public function nextIdentity(): OrderId
    {
        return OrderId::generate();
    }
}
