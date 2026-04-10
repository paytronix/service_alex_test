<?php

declare(strict_types=1);

namespace App\Interface\Http\Controller;

use App\Application\Command\CreateOrderCommand;
use App\Application\Command\Handler\CreateOrderHandler;
use App\Application\Query\GetOrderQuery;
use App\Application\Query\Handler\GetOrderHandler;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;
use App\Interface\Http\Dto\CancelOrderRequest;
use App\Interface\Http\Dto\CreateOrderRequest;
use App\Interface\Http\Exception\ApiProblemException;
use App\Interface\Http\Mapper\OrderMapper;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/orders')]
final class OrderController
{
    public function __construct(
        private readonly CreateOrderHandler $createOrderHandler,
        private readonly GetOrderHandler $getOrderHandler,
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderMapper $orderMapper,
        private readonly ValidatorInterface $validator,
    ) {
    }

    #[Route('', name: 'order_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $dto = CreateOrderRequest::fromArray($data);

        $violations = $this->validator->validate($dto);
        if (count($violations) > 0) {
            $errors = $this->formatValidationErrors($violations);
            throw ApiProblemException::validationFailed($errors);
        }

        $command = new CreateOrderCommand(
            customerEmail: $dto->customerEmail,
            customerFirstName: $dto->customerFirstName,
            customerLastName: $dto->customerLastName,
            customerPhone: $dto->customerPhone,
            customerCompany: $dto->customerCompany,
            customerAddressLine1: $dto->customerAddressLine1,
            customerAddressLine2: $dto->customerAddressLine2,
            customerCity: $dto->customerCity,
            customerState: $dto->customerState,
            customerPostalCode: $dto->customerPostalCode,
            customerCountry: $dto->customerCountry,
            currency: $dto->currency,
            notes: $dto->notes,
            items: $dto->items,
        );

        $orderId = ($this->createOrderHandler)($command);

        $order = ($this->getOrderHandler)(new GetOrderQuery($orderId->value()));
        if ($order === null) {
            throw ApiProblemException::internalError('Failed to retrieve created order');
        }

        $response = $this->orderMapper->toOrderResponse($order);

        return new JsonResponse($response->toArray(), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'order_get', methods: ['GET'])]
    public function get(string $id): JsonResponse
    {
        $order = ($this->getOrderHandler)(new GetOrderQuery($id));

        if ($order === null) {
            throw ApiProblemException::notFound('Order', $id);
        }

        $response = $this->orderMapper->toOrderResponse($order);

        return new JsonResponse($response->toArray(), Response::HTTP_OK);
    }

    #[Route('/{id}/submit', name: 'order_submit', methods: ['POST'])]
    public function submit(string $id): JsonResponse
    {
        $order = $this->findOrderOrFail($id);

        $order->submit();
        $this->orderRepository->save($order);

        $response = $this->orderMapper->toOrderResponse($order);

        return new JsonResponse($response->toArray(), Response::HTTP_OK);
    }

    #[Route('/{id}/cancel', name: 'order_cancel', methods: ['POST'])]
    public function cancel(string $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $dto = CancelOrderRequest::fromArray($data);

        $violations = $this->validator->validate($dto);
        if (count($violations) > 0) {
            $errors = $this->formatValidationErrors($violations);
            throw ApiProblemException::validationFailed($errors);
        }

        $order = $this->findOrderOrFail($id);

        $order->cancel($dto->reason);
        $this->orderRepository->save($order);

        $response = $this->orderMapper->toOrderResponse($order);

        return new JsonResponse($response->toArray(), Response::HTTP_OK);
    }

    private function findOrderOrFail(string $id): Order
    {
        $order = ($this->getOrderHandler)(new GetOrderQuery($id));

        if ($order === null) {
            throw ApiProblemException::notFound('Order', $id);
        }

        return $order;
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
