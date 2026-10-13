/*
@codescope
@title Parcel Booking
@seed ratePerKilo min=40 max=70 step=5
@seed bookingFee min=15 max=30 step=5
@input target=weight value=5 min=1 max=12
*/
#include <stdio.h>

int main(void)
{
    int weight;
    int ratePerKilo = 55;
    int bookingFee = 20;
    int shippingCost;

    printf("Parcel weight in kg: ");
    scanf("%d", &weight);
    shippingCost = weight * ratePerKilo + bookingFee;

    printf("PARCEL BOOKING\n");
    printf("Accepted weight: %d kg\n", weight);
    printf("Shipping cost: P%d\n", shippingCost);

    return 0;
}

