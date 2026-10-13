/*
@codescope
@title Event Reservation
@seed guests min=18 max=38 step=2
@seed hallCapacity min=24 max=32 step=2
@seed mealCost min=180 max=240 step=20
@seed deposit min=1000 max=1600 step=200
*/
#include <stdio.h>

int main(void)
{
    int guests = 28;
    int hallCapacity = 30;
    int mealCost = 200;
    int deposit = 1200;
    int reservationCost;
    int accepted;

    reservationCost = guests * mealCost;

    if (guests <= hallCapacity) {
        accepted = 1;
        reservationCost = reservationCost - deposit;
    } else {
        accepted = 0;
        reservationCost = deposit;
    }

    printf("EVENT RESERVATION\n");
    printf("Reservation status: %d\n", accepted);
    printf("Balance for processing: P%d\n", reservationCost);

    return 0;
}

