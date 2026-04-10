<?php

declare(strict_types=1);

namespace App\Presentation\Validator;

use App\Application\Service\MenuServiceClientInterface;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

final class ValidOrderItemsValidator extends ConstraintValidator
{
    public function __construct(
        private readonly MenuServiceClientInterface $menuServiceClient,
    ) {
    }

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof ValidOrderItems) {
            throw new UnexpectedTypeException($constraint, ValidOrderItems::class);
        }

        if ($value === null || $value === []) {
            return;
        }

        if (!is_array($value)) {
            throw new UnexpectedValueException($value, 'array');
        }

        $productIds = [];
        foreach ($value as $index => $item) {
            if (!is_array($item)) {
                $this->context->buildViolation($constraint->message)
                    ->atPath("[$index]")
                    ->addViolation();
                continue;
            }

            if (!isset($item['product_id']) || empty($item['product_id'])) {
                $this->context->buildViolation($constraint->missingProductIdMessage)
                    ->atPath("[$index].product_id")
                    ->addViolation();
                continue;
            }

            $productId = $item['product_id'];

            if (isset($item['quantity']) && (!is_int($item['quantity']) || $item['quantity'] < 1)) {
                $this->context->buildViolation($constraint->invalidQuantityMessage)
                    ->setParameter('{{ product_id }}', $productId)
                    ->atPath("[$index].quantity")
                    ->addViolation();
            }

            if (isset($item['unit_price']) && (!is_int($item['unit_price']) || $item['unit_price'] < 0)) {
                $this->context->buildViolation($constraint->invalidPriceMessage)
                    ->setParameter('{{ product_id }}', $productId)
                    ->atPath("[$index].unit_price")
                    ->addViolation();
            }

            $productIds[$index] = $productId;
        }

        if (empty($productIds)) {
            return;
        }

        $availability = $this->menuServiceClient->areItemsAvailable(array_values($productIds));

        foreach ($productIds as $index => $productId) {
            if (!isset($availability[$productId]) || !$availability[$productId]) {
                $this->context->buildViolation($constraint->itemUnavailableMessage)
                    ->setParameter('{{ product_id }}', $productId)
                    ->atPath("[$index].product_id")
                    ->addViolation();
            }
        }
    }
}
