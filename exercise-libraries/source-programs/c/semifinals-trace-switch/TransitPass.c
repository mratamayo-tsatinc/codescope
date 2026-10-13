/*
@codescope
@title Transit Pass
@seed passType min=1 max=3
@seed rides min=4 max=12 step=2
@seed peakHour min=0 max=1
*/
#include <stdio.h>

int main(void)
{
    int passType = 2;
    int rides = 8;
    int peakHour = 1;
    int fare;

    switch (passType)
    {
        case 1:
            fare = rides * 12;
            break;
        case 2:
            fare = rides * 10;
            if (peakHour == 1) {
                fare = fare + 20;
            }
            break;
        default:
            fare = rides * 8;
    }

    printf("TRANSIT PASS\n");
    printf("Loaded fare: P%d\n", fare);

    return 0;
}

