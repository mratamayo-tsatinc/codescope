/*
@codescope
@title Booking Channel
@seed channel min=1 max=3
@seed seats min=1 max=5
@seed seatPrice min=180 max=260 step=20
*/
#include <stdio.h>

int main(void)
{
    int channel = 2;
    int seats = 3;
    int seatPrice = 220;
    int fee;
    int bookingTotal;

    switch (channel)
    {
        case 1:
            fee = 20;
            break;
        case 2:
            fee = 35;
            break;
        default:
            fee = 50;
    }

    bookingTotal = seats * seatPrice + fee;

    if (seats >= 4) {
        bookingTotal = bookingTotal - 40;
    }

    printf("BOOKING CONFIRMATION\n");
    printf("Seats reserved: %d\n", seats);
    printf("Payment total: P%d\n", bookingTotal);

    return 0;
}

