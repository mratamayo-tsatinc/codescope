/*
@codescope
@title Parking Checkout
@seed hourlyRate min=20 max=40 step=5
@input target=hours value=4 min=1 max=10
*/
#include <stdio.h>

int main(void)
{
    int hours;
    int hourlyRate = 30;
    int parkingFee;

    printf("Hours parked: ");
    scanf("%d", &hours);
    parkingFee = hours * hourlyRate;

    printf("PARKING CHECKOUT\n");
    printf("Duration: %d hours\n", hours);
    printf("Amount due: P%d\n", parkingFee);

    return 0;
}

