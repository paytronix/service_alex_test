<?php

declare(strict_types=1);

namespace App\Interface\Http\Controller;

use App\Application\Command\Handler\RegisterUserHandler;
use App\Application\Command\RegisterUserCommand;
use App\Interface\Http\Dto\RegisterRequest;
use App\Interface\Http\Exception\ApiProblemException;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api')]
final class AuthController
{
    public function __construct(
        private readonly RegisterUserHandler $registerUserHandler,
        private readonly ValidatorInterface $validator,
        private readonly Security $security,
    ) {
    }

    #[Route('/register', name: 'api_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $dto = RegisterRequest::fromArray($data);

        $violations = $this->validator->validate($dto);
        if (count($violations) > 0) {
            $errors = $this->formatValidationErrors($violations);
            throw ApiProblemException::validationFailed($errors);
        }

        $command = new RegisterUserCommand(
            email: $dto->email,
            password: $dto->password,
            firstName: $dto->firstName,
            lastName: $dto->lastName,
        );

        $user = ($this->registerUserHandler)($command);

        return new JsonResponse([
            'id' => $user->id()->value(),
            'email' => $user->email(),
            'first_name' => $user->firstName(),
            'last_name' => $user->lastName(),
            'roles' => $user->getRoles(),
            'created_at' => $user->createdAt()->format(),
        ], Response::HTTP_CREATED);
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->security->getUser();

        if (!$user instanceof \App\Domain\Entity\User) {
            throw ApiProblemException::internalError('Unable to resolve authenticated user');
        }

        return new JsonResponse([
            'id' => $user->id()->value(),
            'email' => $user->email(),
            'first_name' => $user->firstName(),
            'last_name' => $user->lastName(),
            'roles' => $user->getRoles(),
            'is_active' => $user->isActive(),
            'created_at' => $user->createdAt()->format(),
            'updated_at' => $user->updatedAt()->format(),
        ], Response::HTTP_OK);
    }

    private function formatValidationErrors(\Symfony\Component\Validator\ConstraintViolationListInterface $violations): array
    {
        $errors = [];
        foreach ($violations as $violation) {
            $propertyPath = $violation->getPropertyPath();
            $errors[$propertyPath][] = $violation->getMessage();
        }

        return $errors;
    }
}
