/*
@codescope
@title Delivery Route Cost
@seed stops min=3 max=7
@seed costPerStop min=25 max=45 step=5
@seed fuelAllowance min=80 max=140 step=10
*/
#include <stdio.h>

int main(void)
{
    int stops = 5;
    int costPerStop = 35;
    int fuelAllowance = 100;
    int serviceCost;
    int routeBudget;

    serviceCost = stops * costPerStop;
    routeBudget = serviceCost + fuelAllowance;

    printf("DELIVERY ROUTE\n");
    printf("Scheduled stops: %d\n", stops);
    printf("Service cost: P%d\n", serviceCost);
    printf("Fuel allowance: P%d\n", fuelAllowance);
    printf("Route budget: P%d\n", routeBudget);

    return 0;
}

