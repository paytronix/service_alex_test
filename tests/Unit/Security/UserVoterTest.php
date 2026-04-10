<?php

declare(strict_types=1);

namespace App\Tests\Unit\Security;

use App\Domain\Entity\User;
use App\Infrastructure\Security\Voter\UserVoter;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\VoterInterface;

class UserVoterTest extends TestCase
{
    private UserVoter $voter;

    protected function setUp(): void
    {
        $this->voter = new UserVoter();
    }

    public function testAdminCanViewAnyUser(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $targetUser = $this->createUser('target@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $targetUser, [UserVoter::VIEW])
        );
    }

    public function testAdminCanEditAnyUser(): void
    {
        $admin = $this->createUser('admin@test.com', ['ROLE_ADMIN']);
        $targetUser = $this->createUser('target@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($admin), $targetUser, [UserVoter::EDIT])
        );
    }

    public function testUserCanViewOwnProfile(): void
    {
        $user = $this->createUser('user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $user, [UserVoter::VIEW])
        );
    }

    public function testUserCanEditOwnProfile(): void
    {
        $user = $this->createUser('user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_GRANTED,
            $this->voter->vote($this->createToken($user), $user, [UserVoter::EDIT])
        );
    }

    public function testUserCannotViewOtherUserProfile(): void
    {
        $user = $this->createUser('user@test.com');
        $otherUser = $this->createUser('other@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $otherUser, [UserVoter::VIEW])
        );
    }

    public function testUserCannotEditOtherUserProfile(): void
    {
        $user = $this->createUser('user@test.com');
        $otherUser = $this->createUser('other@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($this->createToken($user), $otherUser, [UserVoter::EDIT])
        );
    }

    public function testUnsupportedAttributeReturnsAbstain(): void
    {
        $user = $this->createUser('user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_ABSTAIN,
            $this->voter->vote($this->createToken($user), $user, ['UNSUPPORTED_ATTRIBUTE'])
        );
    }

    public function testNonUserSubjectReturnsAbstain(): void
    {
        $user = $this->createUser('user@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_ABSTAIN,
            $this->voter->vote($this->createToken($user), new \stdClass(), [UserVoter::VIEW])
        );
    }

    public function testUnauthenticatedUserIsDenied(): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);

        $targetUser = $this->createUser('target@test.com');

        $this->assertEquals(
            VoterInterface::ACCESS_DENIED,
            $this->voter->vote($token, $targetUser, [UserVoter::VIEW])
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

    private function createToken(User $user): TokenInterface
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        return $token;
    }
}
