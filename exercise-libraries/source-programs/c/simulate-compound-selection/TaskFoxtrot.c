/*
@codescope
@title Room Cost Transaction
@seed days min=4 max=8
@seed dailyRate min=60 max=90 step=10
@seed transport min=35 max=55 step=5
*/
#include <stdio.h>

int main(void)
{
    int days = 6, dailyRate = 80, transport = 45;
    int roomCost, totalCost, covered;

    roomCost = days * dailyRate + 30 / 2;
    totalCost = roomCost + transport;
    covered = (days >= 5 && dailyRate <= 100) || (transport < 20 && !((days > 10)));

    if (covered && totalCost <= 550) {
        totalCost = totalCost + 0;
    } else if (!covered || totalCost > 800) {
        totalCost = totalCost + 75;
    }

    printf("days = %d\n", days);
    printf("dailyRate = %d\n", dailyRate);
    printf("transport = %d\n", transport);
    printf("roomCost = %d\n", roomCost);
    printf("totalCost = %d\n", totalCost);
    printf("covered = %d\n", covered);
    return 0;
}
