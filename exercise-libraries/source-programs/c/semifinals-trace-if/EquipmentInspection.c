/*
@codescope
@title Equipment Inspection
@seed operatingHours min=80 max=160 step=10
@seed serviceLimit min=100 max=140 step=10
@seed maintenanceDays min=2 max=5
*/
#include <stdio.h>

int main(void)
{
    int operatingHours = 130;
    int serviceLimit = 120;
    int maintenanceDays = 3;
    int downtime = 0;

    if (operatingHours >= serviceLimit) {
        downtime = maintenanceDays;
    }

    printf("EQUIPMENT INSPECTION\n");
    printf("Scheduled downtime: %d days\n", downtime);

    return 0;
}

