/*
@codescope
@title Laundry Service Claim
@seed kilos min=3 max=8
@seed rate min=35 max=55 step=5
@seed serviceFee min=15 max=35 step=5
*/
#include <stdio.h>

int main(void)
{
    int kilos = 5;
    int rate = 45;
    int serviceFee = 25;
    int washCost;
    int claimTotal;

    washCost = kilos * rate;
    claimTotal = washCost + serviceFee;

    printf("LAUNDRY CLAIM\n");
    printf("Load: %d kg\n", kilos);
    printf("Wash cost: P%d\n", washCost);
    printf("Service fee: P%d\n", serviceFee);
    printf("Claim total: P%d\n", claimTotal);

    return 0;
}

