<?php

declare(strict_types=1);

namespace App\Infrastructure\Security\Voter;

use App\Domain\Entity\Order;
use App\Domain\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

class OrderVoter extends Voter
{
    public const VIEW = 'ORDER_VIEW';
    public const EDIT = 'ORDER_EDIT';
    public const CANCEL = 'ORDER_CANCEL';
    public const SUBMIT = 'ORDER_SUBMIT';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::VIEW, self::EDIT, self::CANCEL, self::SUBMIT], true)
            && $subject instanceof Order;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        if (in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            return true;
        }

        /** @var Order $order */
        $order = $subject;

        return match ($attribute) {
            self::VIEW, self::EDIT, self::SUBMIT => $this->isOwner($order, $user),
            self::CANCEL => $this->canCancel($order, $user),
            default => false,
        };
    }

    private function isOwner(Order $order, User $user): bool
    {
        return $order->ownedBy($user->getUserIdentifier());
    }

    private function canCancel(Order $order, User $user): bool
    {
        return $this->isOwner($order, $user) && $order->canBeCancelled();
    }
}
