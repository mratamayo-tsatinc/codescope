/*
@codescope
@title Equipment Rental
@seed equipmentCode min=1 max=4
@seed days min=2 max=6
@seed insurance min=50 max=100 step=25
*/
#include <stdio.h>

int main(void)
{
    int equipmentCode = 3;
    int days = 4;
    int insurance = 75;
    int dailyRate;
    int rentalTotal;

    switch (equipmentCode)
    {
        case 1:
            dailyRate = 150;
            break;
        case 2:
            dailyRate = 220;
            break;
        case 3:
            dailyRate = 300;
            break;
        default:
            dailyRate = 120;
    }

    rentalTotal = days * dailyRate + insurance;

    printf("EQUIPMENT RENTAL\n");
    printf("Rental period: %d days\n", days);
    printf("Amount payable: P%d\n", rentalTotal);

    return 0;
}

