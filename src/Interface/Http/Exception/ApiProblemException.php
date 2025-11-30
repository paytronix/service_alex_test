<?php

declare(strict_types=1);

namespace App\Interface\Http\Exception;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class ApiProblemException extends HttpException
{
    private string $type;
    private string $title;
    private array $errors;

    public function __construct(
        int $statusCode,
        string $type,
        string $title,
        string $detail = '',
        array $errors = [],
        ?\Throwable $previous = null
    ) {
        $this->type = $type;
        $this->title = $title;
        $this->errors = $errors;

        parent::__construct($statusCode, $detail, $previous);
    }

    public static function validationFailed(array $errors, string $detail = 'Validation failed'): self
    {
        return new self(
            statusCode: 400,
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            detail: $detail,
            errors: $errors,
        );
    }

    public static function notFound(string $resource, string $id): self
    {
        return new self(
            statusCode: 404,
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            detail: sprintf('%s with ID %s not found', $resource, $id),
        );
    }

    public static function domainRuleViolation(string $detail, ?\Throwable $previous = null): self
    {
        return new self(
            statusCode: 422,
            type: 'https://tools.ietf.org/html/rfc4918#section-11.2',
            title: 'Unprocessable Entity',
            detail: $detail,
            previous: $previous,
        );
    }

    public static function internalError(string $detail = 'An internal error occurred', ?\Throwable $previous = null): self
    {
        return new self(
            statusCode: 500,
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: 'Internal Server Error',
            detail: $detail,
            previous: $previous,
        );
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getDetail(): string
    {
        return $this->getMessage();
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function toArray(): array
    {
        $result = [
            'type' => $this->type,
            'title' => $this->title,
            'status' => $this->getStatusCode(),
            'detail' => $this->getDetail(),
        ];

        if (!empty($this->errors)) {
            $result['errors'] = $this->errors;
        }

        return $result;
    }
}
