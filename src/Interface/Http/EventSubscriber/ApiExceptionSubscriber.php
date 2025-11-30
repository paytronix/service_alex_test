<?php

declare(strict_types=1);

namespace App\Interface\Http\EventSubscriber;

use App\Application\Exception\OrderValidationException;
use App\Interface\Http\Exception\ApiProblemException;
use DomainException;
use InvalidArgumentException;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

final class ApiExceptionSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly string $environment,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::EXCEPTION => ['onKernelException', 0],
        ];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        $request = $event->getRequest();

        if (!$this->isApiRequest($request)) {
            return;
        }

        $exception = $event->getThrowable();
        $response = $this->createJsonResponse($exception);

        $event->setResponse($response);
    }

    private function isApiRequest(\Symfony\Component\HttpFoundation\Request $request): bool
    {
        $contentType = $request->headers->get('Content-Type', '');
        $accept = $request->headers->get('Accept', '');
        $path = $request->getPathInfo();

        return str_contains($contentType, 'application/json')
            || str_contains($accept, 'application/json')
            || str_starts_with($path, '/orders')
            || str_starts_with($path, '/api');
    }

    private function createJsonResponse(\Throwable $exception): JsonResponse
    {
        if ($exception instanceof ApiProblemException) {
            return new JsonResponse(
                $exception->toArray(),
                $exception->getStatusCode(),
                ['Content-Type' => 'application/problem+json']
            );
        }

        if ($exception instanceof OrderValidationException) {
            $data = [
                'type' => 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                'title' => 'Bad Request',
                'status' => 400,
                'detail' => $exception->getMessage(),
                'errors' => $exception->errors(),
            ];

            return new JsonResponse($data, 400, ['Content-Type' => 'application/problem+json']);
        }

        if ($exception instanceof DomainException) {
            $data = [
                'type' => 'https://tools.ietf.org/html/rfc4918#section-11.2',
                'title' => 'Unprocessable Entity',
                'status' => 422,
                'detail' => $exception->getMessage(),
            ];

            return new JsonResponse($data, 422, ['Content-Type' => 'application/problem+json']);
        }

        if ($exception instanceof InvalidArgumentException) {
            $data = [
                'type' => 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                'title' => 'Bad Request',
                'status' => 400,
                'detail' => $exception->getMessage(),
            ];

            return new JsonResponse($data, 400, ['Content-Type' => 'application/problem+json']);
        }

        if ($exception instanceof HttpExceptionInterface) {
            $statusCode = $exception->getStatusCode();
            $data = [
                'type' => $this->getTypeForStatusCode($statusCode),
                'title' => $this->getTitleForStatusCode($statusCode),
                'status' => $statusCode,
                'detail' => $exception->getMessage(),
            ];

            return new JsonResponse($data, $statusCode, ['Content-Type' => 'application/problem+json']);
        }

        $statusCode = 500;
        $data = [
            'type' => 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            'title' => 'Internal Server Error',
            'status' => $statusCode,
            'detail' => $this->environment === 'dev' ? $exception->getMessage() : 'An internal error occurred',
        ];

        if ($this->environment === 'dev') {
            $data['trace'] = $exception->getTraceAsString();
        }

        return new JsonResponse($data, $statusCode, ['Content-Type' => 'application/problem+json']);
    }

    private function getTypeForStatusCode(int $statusCode): string
    {
        return match ($statusCode) {
            400 => 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
            401 => 'https://tools.ietf.org/html/rfc7235#section-3.1',
            403 => 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
            404 => 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
            405 => 'https://tools.ietf.org/html/rfc7231#section-6.5.5',
            409 => 'https://tools.ietf.org/html/rfc7231#section-6.5.8',
            422 => 'https://tools.ietf.org/html/rfc4918#section-11.2',
            500 => 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            default => 'about:blank',
        };
    }

    private function getTitleForStatusCode(int $statusCode): string
    {
        return match ($statusCode) {
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            409 => 'Conflict',
            422 => 'Unprocessable Entity',
            500 => 'Internal Server Error',
            default => 'Error',
        };
    }
}
