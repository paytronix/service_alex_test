<?php

declare(strict_types=1);

namespace App\Interface\Http\Controller;

use App\Application\Query\GetOrderQuery;
use App\Application\Query\Handler\GetOrderHandler;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\Money;
use App\Interface\Http\Dto\AddOrderItemRequest;
use App\Interface\Http\Exception\ApiProblemException;
use App\Interface\Http\Mapper\OrderMapper;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/orders/{orderId}/items')]
#[IsGranted('IS_AUTHENTICATED_FULLY')]
final class OrderItemController
{
    public function __construct(
        private readonly GetOrderHandler $getOrderHandler,
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderMapper $orderMapper,
        private readonly ValidatorInterface $validator,
        private readonly AuthorizationCheckerInterface $authorizationChecker,
    ) {
    }

    #[Route('', name: 'order_item_add', methods: ['POST'])]
    public function add(string $orderId, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $dto = AddOrderItemRequest::fromArray($data);

        $violations = $this->validator->validate($dto);
        if (count($violations) > 0) {
            $errors = $this->formatValidationErrors($violations);
            throw ApiProblemException::validationFailed($errors);
        }

        $order = $this->findOrderOrFail($orderId);

        $this->denyAccessUnlessGranted('ORDER_EDIT', $order);

        $unitPrice = Money::create($dto->unitPrice, $order->totalAmount()->currency());

        $order->addItem(
            productId: $dto->productId,
            productName: $dto->productName,
            quantity: $dto->quantity,
            unitPrice: $unitPrice,
            productSku: $dto->productSku,
            notes: $dto->notes,
        );

        $this->orderRepository->save($order);

        $response = $this->orderMapper->toOrderResponse($order);

        return new JsonResponse($response->toArray(), Response::HTTP_CREATED);
    }

    private function findOrderOrFail(string $id): Order
    {
        $order = ($this->getOrderHandler)(new GetOrderQuery($id));

        if ($order === null) {
            throw ApiProblemException::notFound('Order', $id);
        }

        return $order;
    }

    private function denyAccessUnlessGranted(string $attribute, mixed $subject): void
    {
        if (!$this->authorizationChecker->isGranted($attribute, $subject)) {
            throw new AccessDeniedException('Access denied.');
        }
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
