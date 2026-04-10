<?php

declare(strict_types=1);

namespace App\Presentation\Validator;

use Attribute;
use Symfony\Component\Validator\Constraint;

#[Attribute(Attribute::TARGET_PROPERTY | Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class ValidOrderItems extends Constraint
{
    public string $message = 'One or more order items are invalid or unavailable.';
    public string $itemUnavailableMessage = 'Item "{{ product_id }}" is not available.';
    public string $missingProductIdMessage = 'Each item must have a product_id.';
    public string $invalidQuantityMessage = 'Item "{{ product_id }}" has invalid quantity. Quantity must be at least 1.';
    public string $invalidPriceMessage = 'Item "{{ product_id }}" has invalid unit price. Price must be non-negative.';

    public function validatedBy(): string
    {
        return ValidOrderItemsValidator::class;
    }
}
