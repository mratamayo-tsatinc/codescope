/*
@codescope
@title Cooperative Loan Decision
@seed income min=18000 max=32000 step=2000
@seed requested min=12000 max=24000 step=2000
@seed limit min=18000 max=26000 step=2000
*/
#include <stdio.h>

int main(void)
{
    int income = 26000;
    int requested = 18000;
    int limit = 22000;
    int approvedAmount;

    if (income >= requested && requested <= limit) {
        approvedAmount = requested;
    } else {
        approvedAmount = 0;
    }

    printf("COOPERATIVE LOAN\n");
    printf("Approved amount: P%d\n", approvedAmount);

    return 0;
}

