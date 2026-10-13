/*
@codescope
@title Courier Incentive
@seed deliveries min=8 max=16 step=2
@seed rate min=35 max=55 step=5
@seed distance min=30 max=70 step=10
@seed incentive min=60 max=100 step=20
*/
#include <stdio.h>

int main(void)
{
    int deliveries = 12;
    int rate = 45;
    int distance = 50;
    int incentive = 80;
    int earnings;
    int creditedBonus = 0;

    earnings = deliveries * rate;

    if (deliveries >= 10 && distance >= 40) {
        creditedBonus = incentive;
        earnings = earnings + creditedBonus;
    }

    printf("COURIER PAYOUT\n");
    printf("Completed deliveries: %d\n", deliveries);
    printf("Incentive credited: P%d\n", creditedBonus);
    printf("Total earnings: P%d\n", earnings);

    return 0;
}

