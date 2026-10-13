/*
@codescope
@title Internet Plan Billing
@seed usage min=30 max=120 step=10
@seed baseRate min=500 max=700 step=50
@seed excessRate min=8 max=12 step=2
*/
#include <stdio.h>

int main(void)
{
    int usage = 80;
    int baseRate = 600;
    int excessRate = 10;
    int allowance;
    int bill;

    if (usage <= 40) {
        allowance = 40;
        bill = baseRate;
    } else if (usage <= 80) {
        allowance = 60;
        bill = baseRate + (usage - allowance) * excessRate;
    } else {
        allowance = 70;
        bill = baseRate + (usage - allowance) * excessRate + 100;
    }

    printf("INTERNET BILL\n");
    printf("Plan allowance: %d GB\n", allowance);
    printf("Current charge: P%d\n", bill);

    return 0;
}

