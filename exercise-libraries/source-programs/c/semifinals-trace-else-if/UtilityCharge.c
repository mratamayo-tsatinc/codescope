/*
@codescope
@title Water Service Charge
@seed consumption min=8 max=38 step=2
@seed baseCharge min=100 max=140 step=10
*/
#include <stdio.h>

int main(void)
{
    int consumption = 24;
    int baseCharge = 120;
    int serviceCharge;

    if (consumption <= 10) {
        serviceCharge = baseCharge;
    } else if (consumption <= 20) {
        serviceCharge = baseCharge + 60;
    } else if (consumption <= 30) {
        serviceCharge = baseCharge + 140;
    } else {
        serviceCharge = baseCharge + 240;
    }

    printf("WATER SERVICE BILL\n");
    printf("Metered use: %d units\n", consumption);
    printf("Service charge: P%d\n", serviceCharge);

    return 0;
}

