<?php

declare(strict_types=1);

namespace App\Interface\Http\Mapper;

use App\Domain\Entity\OrderCustomer;
use App\Interface\Http\Dto\OrderCustomerResponse;

final class OrderCustomerMapper
{
    public function toOrderCustomerResponse(OrderCustomer $customer): OrderCustomerResponse
    {
        return new OrderCustomerResponse(
            email: $customer->email(),
            firstName: $customer->firstName(),
            lastName: $customer->lastName(),
            fullName: $customer->fullName(),
            phone: $customer->phone(),
            company: $customer->company(),
            addressLine1: $customer->addressLine1(),
            addressLine2: $customer->addressLine2(),
            city: $customer->city(),
            state: $customer->state(),
            postalCode: $customer->postalCode(),
            country: $customer->country(),
        );
    }
}
