<?php

declare(strict_types=1);

namespace App\Tests\Functional\Security;

use App\Domain\Entity\User;
use App\Domain\Repository\UserRepositoryInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

trait SecurityTestTrait
{
    private function createTestUser(
        string $email = 'test@example.com',
        string $password = 'password123',
        array $roles = ['ROLE_USER'],
        string $firstName = 'Test',
        string $lastName = 'User',
    ): User {
        $container = static::getContainer();
        $userRepository = $container->get(UserRepositoryInterface::class);
        $passwordHasher = $container->get(UserPasswordHasherInterface::class);

        $tempUser = User::create(
            email: $email,
            hashedPassword: 'temp',
            firstName: $firstName,
            lastName: $lastName,
            roles: $roles,
        );

        $hashedPassword = $passwordHasher->hashPassword($tempUser, $password);

        $user = User::create(
            email: $email,
            hashedPassword: $hashedPassword,
            firstName: $firstName,
            lastName: $lastName,
            roles: $roles,
        );

        $userRepository->save($user);

        return $user;
    }

    private function getJwtToken(KernelBrowser $client, string $email, string $password): string
    {
        $client->request(
            'POST',
            '/api/login_check',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['username' => $email, 'password' => $password])
        );

        $response = $client->getResponse();
        $data = json_decode($response->getContent(), true);

        return $data['token'] ?? '';
    }

    private function createAuthenticatedClient(
        string $email = 'test@example.com',
        string $password = 'password123',
        array $roles = ['ROLE_USER'],
    ): KernelBrowser {
        $client = static::createClient();
        $this->createTestUser($email, $password, $roles);

        $token = $this->getJwtToken($client, $email, $password);

        $client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);

        return $client;
    }
}
