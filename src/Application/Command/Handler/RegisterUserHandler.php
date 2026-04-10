<?php

declare(strict_types=1);

namespace App\Application\Command\Handler;

use App\Application\Command\RegisterUserCommand;
use App\Domain\Entity\User;
use App\Domain\Repository\UserRepositoryInterface;
use App\Interface\Http\Exception\ApiProblemException;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class RegisterUserHandler
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public function __invoke(RegisterUserCommand $command): User
    {
        $existingUser = $this->userRepository->findByEmail($command->email);
        if ($existingUser !== null) {
            throw new ApiProblemException(
                409,
                'https://tools.ietf.org/html/rfc7231#section-6.5.8',
                'Conflict',
                sprintf('User with email "%s" already exists', $command->email)
            );
        }

        $user = User::create(
            email: $command->email,
            hashedPassword: '',
            firstName: $command->firstName,
            lastName: $command->lastName,
        );

        $hashedPassword = $this->passwordHasher->hashPassword($user, $command->password);

        $user = User::create(
            email: $command->email,
            hashedPassword: $hashedPassword,
            firstName: $command->firstName,
            lastName: $command->lastName,
        );

        $this->userRepository->save($user);

        return $user;
    }
}
