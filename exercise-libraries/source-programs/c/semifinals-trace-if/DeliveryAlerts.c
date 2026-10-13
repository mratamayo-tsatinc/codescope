/*
@codescope
@title Delivery Alerts
@seed distance min=4 max=14
@seed parcels min=2 max=8
@seed charge min=40 max=70 step=5
*/
#include <stdio.h>

int main(void)
{
    int distance = 11;
    int parcels = 6;
    int charge = 50;
    int alerts = 0;

    if (distance > 8) {
        charge = charge + 25;
        alerts = alerts + 1;
    }

    if (parcels > 5) {
        charge = charge + 15;
        alerts = alerts + 1;
    }

    printf("DELIVERY ASSESSMENT\n");
    printf("Applied alerts: %d\n", alerts);
    printf("Delivery charge: P%d\n", charge);

    return 0;
}

