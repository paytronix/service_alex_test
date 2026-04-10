<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MongoDB\Repository;

use App\Domain\Entity\User;
use App\Domain\Repository\UserRepositoryInterface;
use App\Domain\ValueObject\UserId;
use App\Infrastructure\Persistence\MongoDB\Document\UserDocument;
use Doctrine\ODM\MongoDB\DocumentManager;

class UserRepository implements UserRepositoryInterface
{
    private DocumentManager $documentManager;

    public function __construct(DocumentManager $documentManager)
    {
        $this->documentManager = $documentManager;
    }

    public function save(User $user): void
    {
        $document = UserDocument::fromDomainEntity($user);

        $existingDocument = $this->documentManager
            ->getRepository(UserDocument::class)
            ->find($user->id()->value());

        if ($existingDocument !== null) {
            $this->documentManager->detach($existingDocument);
        }

        $this->documentManager->persist($document);
        $this->documentManager->flush();
    }

    public function findById(UserId $id): ?User
    {
        $document = $this->documentManager
            ->getRepository(UserDocument::class)
            ->find($id->value());

        if ($document === null) {
            return null;
        }

        return $document->toDomainEntity();
    }

    public function findByEmail(string $email): ?User
    {
        $document = $this->documentManager
            ->getRepository(UserDocument::class)
            ->findOneBy(['email' => $email]);

        if ($document === null) {
            return null;
        }

        return $document->toDomainEntity();
    }

    public function remove(User $user): void
    {
        $document = $this->documentManager
            ->getRepository(UserDocument::class)
            ->find($user->id()->value());

        if ($document !== null) {
            $this->documentManager->remove($document);
            $this->documentManager->flush();
        }
    }
}
