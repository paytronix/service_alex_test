<?php

declare(strict_types=1);

namespace App\Tests\Functional\Security;

use App\Domain\Repository\UserRepositoryInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AuthenticationTest extends WebTestCase
{
    use SecurityTestTrait;

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function testSuccessfulRegistration(): void
    {
        $payload = [
            'email' => 'newuser@example.com',
            'password' => 'securePassword123',
            'first_name' => 'New',
            'last_name' => 'User',
        ];

        $this->client->request(
            'POST',
            '/api/register',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(201, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('id', $data);
        $this->assertEquals('newuser@example.com', $data['email']);
        $this->assertEquals('New', $data['first_name']);
        $this->assertEquals('User', $data['last_name']);
        $this->assertContains('ROLE_USER', $data['roles']);
    }

    public function testDuplicateEmailRegistration(): void
    {
        $this->createTestUser('existing@example.com', 'password123');

        $payload = [
            'email' => 'existing@example.com',
            'password' => 'anotherPassword',
            'first_name' => 'Another',
            'last_name' => 'User',
        ];

        $this->client->request(
            'POST',
            '/api/register',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(409, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('Conflict', $data['title']);
    }

    public function testSuccessfulLogin(): void
    {
        $this->createTestUser('login@example.com', 'password123');

        $this->client->request(
            'POST',
            '/api/login_check',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['username' => 'login@example.com', 'password' => 'password123'])
        );

        $response = $this->client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertNotEmpty($data['token']);
    }

    public function testFailedLoginWithInvalidCredentials(): void
    {
        $this->createTestUser('login@example.com', 'password123');

        $this->client->request(
            'POST',
            '/api/login_check',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['username' => 'login@example.com', 'password' => 'wrongpassword'])
        );

        $response = $this->client->getResponse();
        $this->assertEquals(401, $response->getStatusCode());
    }

    public function testProtectedEndpointWithoutToken(): void
    {
        $this->client->request(
            'GET',
            '/api/me',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json']
        );

        $response = $this->client->getResponse();
        $this->assertEquals(401, $response->getStatusCode());
    }

    public function testProtectedEndpointWithInvalidToken(): void
    {
        $this->client->request(
            'GET',
            '/api/me',
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_AUTHORIZATION' => 'Bearer invalid.token.here',
            ]
        );

        $response = $this->client->getResponse();
        $this->assertEquals(401, $response->getStatusCode());
    }

    public function testProtectedEndpointWithValidToken(): void
    {
        $this->createTestUser('me@example.com', 'password123');
        $token = $this->getJwtToken($this->client, 'me@example.com', 'password123');

        $this->client->request(
            'GET',
            '/api/me',
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            ]
        );

        $response = $this->client->getResponse();
        $this->assertEquals(200, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertEquals('me@example.com', $data['email']);
    }

    public function testRegistrationValidation(): void
    {
        $payload = [
            'email' => 'invalid-email',
            'password' => 'short',
            'first_name' => '',
            'last_name' => '',
        ];

        $this->client->request(
            'POST',
            '/api/register',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        $response = $this->client->getResponse();
        $this->assertEquals(400, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('errors', $data);
    }
}
