<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MongoDB\Repository;

use App\Domain\Entity\OrderItem;
use App\Domain\Repository\OrderItemRepositoryInterface;
use App\Domain\ValueObject\Money;
use Doctrine\ODM\MongoDB\DocumentManager;

class OrderItemRepository implements OrderItemRepositoryInterface
{
    private DocumentManager $documentManager;

    public function __construct(DocumentManager $documentManager)
    {
        $this->documentManager = $documentManager;
    }

    public function save(OrderItem $item): void
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $itemData = [
            'id' => $item->id(),
            'product_id' => $item->productId(),
            'product_name' => $item->productName(),
            'product_sku' => $item->productSku(),
            'quantity' => $item->quantity(),
            'unit_price_amount' => $item->unitPrice()->amount(),
            'unit_price_currency' => $item->unitPrice()->currency(),
            'notes' => $item->notes(),
        ];

        $collection->updateOne(
            ['items.id' => $item->id()],
            ['$set' => ['items.$' => $itemData]]
        );
    }

    public function findById(string $id): ?OrderItem
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $result = $collection->findOne(
            ['items.id' => $id],
            ['projection' => ['items.$' => 1]]
        );

        if ($result === null || empty($result['items'])) {
            return null;
        }

        $itemData = $result['items'][0];

        return OrderItem::reconstitute(
            $itemData['id'],
            $itemData['product_id'],
            $itemData['product_name'],
            $itemData['product_sku'] ?? null,
            $itemData['quantity'],
            Money::create($itemData['unit_price_amount'], $itemData['unit_price_currency']),
            $itemData['notes'] ?? null
        );
    }

    public function remove(OrderItem $item): void
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $collection->updateOne(
            ['items.id' => $item->id()],
            ['$pull' => ['items' => ['id' => $item->id()]]]
        );
    }

    public function findByProductId(string $productId): array
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $cursor = $collection->find(
            ['items.product_id' => $productId],
            ['projection' => ['items' => 1]]
        );

        $items = [];
        foreach ($cursor as $document) {
            foreach ($document['items'] as $itemData) {
                if ($itemData['product_id'] === $productId) {
                    $items[] = OrderItem::reconstitute(
                        $itemData['id'],
                        $itemData['product_id'],
                        $itemData['product_name'],
                        $itemData['product_sku'] ?? null,
                        $itemData['quantity'],
                        Money::create($itemData['unit_price_amount'], $itemData['unit_price_currency']),
                        $itemData['notes'] ?? null
                    );
                }
            }
        }

        return $items;
    }

    public function findAll(int $limit = 100, int $offset = 0): array
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $cursor = $collection->find(
            [],
            [
                'projection' => ['items' => 1],
                'limit' => $limit,
                'skip' => $offset,
            ]
        );

        $items = [];
        foreach ($cursor as $document) {
            foreach ($document['items'] ?? [] as $itemData) {
                $items[] = OrderItem::reconstitute(
                    $itemData['id'],
                    $itemData['product_id'],
                    $itemData['product_name'],
                    $itemData['product_sku'] ?? null,
                    $itemData['quantity'],
                    Money::create($itemData['unit_price_amount'], $itemData['unit_price_currency']),
                    $itemData['notes'] ?? null
                );
            }
        }

        return $items;
    }

    public function count(): int
    {
        $collection = $this->documentManager->getDocumentCollection(
            \App\Infrastructure\Persistence\MongoDB\Document\OrderDocument::class
        );

        $result = $collection->aggregate([
            ['$unwind' => '$items'],
            ['$count' => 'total'],
        ])->toArray();

        return $result[0]['total'] ?? 0;
    }
}
