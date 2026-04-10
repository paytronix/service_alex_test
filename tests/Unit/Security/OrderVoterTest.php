<?php

declare(strict_types=1);

namespace App\Tests\Unit\Security;

use App\Domain\Entity\Order;
use App\Domain\Entity\OrderCustomer;
use App\Domain\Entity\User;
use App\Domain\ValueObject\Money;
use App\Infrastructure\Security\Voter\OrderVoter;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

class OrderVoterTest extends TestCase
{
    private OrderVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new OrderVoter();
    }

    public function testAdminCanViewAnyOrder(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $order = $this->createOrder('other-user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $order, [OrderVoter::VIEW])
        );
    }

    public function testAdminCanEditAnyOrder(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $order = $this->createOrder('other-user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $order, [OrderVoter::EDIT])
        );
    }

    public function testAdminCanCancelAnyOrder(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $order = $this->createOrder('other-user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $order, [OrderVoter::CANCEL])
        );
    }

    public function testAdminCanSubmitAnyOrder(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $order = $this->createOrder('other-user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $order, [OrderVoter::SUBMIT])
        );
    }

    public function testOwnerCanViewOwnOrder(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::VIEW])
        );
    }

    public function testOwnerCanEditOwnOrder(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::EDIT])
        );
    }

    public function testOwnerCanSubmitOwnOrder(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::SUBMIT])
        );
    }

    public function testOwnerCanCancelOwnCancellableOrder(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::CANCEL])
        );
    }

    public function testOwnerCannotCancelNonCancellableOrder(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createDeliveredOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::CANCEL])
        );
    }

    public function testNonOwnerCannotViewOthersOrder(): void
    {
        $user = $this->createUser('other@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::VIEW])
        );
    }

    public function testNonOwnerCannotEditOthersOrder(): void
    {
        $user = $this->createUser('other@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::EDIT])
        );
    }

    public function testNonOwnerCannotCancelOthersOrder(): void
    {
        $user = $this->createUser('other@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::CANCEL])
        );
    }

    public function testNonOwnerCannotSubmitOthersOrder(): void
    {
        $user = $this->createUser('other@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $order, [OrderVoter::SUBMIT])
        );
    }

    public function testUnsupportedAttributeReturnsAbstain(): void
    {
        $user = $this->createUser('owner@test.com');
        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_ABSTAIN,
            $this->voter->vote($this->createToken($user), $order, ['UNSUPPORTED_ATTRIBUTE'])
        );
    }

    public function testNonOrderSubjectReturnsAbstain(): void
    {
        $user = $this->createUser('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_ABSTAIN,
            $this->voter->vote($this->createToken($user), new \stdClass(), [OrderVoter::VIEW])
        );
    }

    public function testUnauthenticatedUserIsDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $order = $this->createOrder('owner@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($token, $order, [OrderVoter::VIEW])
        );
    }

    private function createUser(string $email, array $roles = ['ROLE_USER']): User
    {
        return User::create(
            email: $email,
            hashedPassword: 'hashed_password',
            firstName: 'Test',
            lastName: 'User',
            roles: $roles,
        );
    }

    private function createOrder(string $ownerEmail): Order
    {
        $customer = OrderCustomer::create(
            email: 'customer@test.com',
            firstName: 'Customer',
            lastName: 'Test',
        );

        return Order::create($customer, 'USD', null, $ownerEmail);
    }

    private function createDeliveredOrder(string $ownerEmail): Order
    {
        $customer = OrderCustomer::create(
            email: 'customer@test.com',
            firstName: 'Customer',
            lastName: 'Test',
        );

        $order = Order::create($customer, 'USD', null, $ownerEmail);
        $order->addItem('PROD-001', 'Product', 1, Money::create(1000, 'USD'));
        $order->submit();
        $order->confirm();
        $order->startProcessing();
        $order->ship();
        $order->deliver();

        return $order;
    }

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
